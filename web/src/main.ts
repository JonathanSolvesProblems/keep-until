import "./styles.css";
import { InferenceMode } from "firebase/ai";
import { browserHasOnDeviceModel, makeModel, makeTriageModel, setRateLimitListener, triageItem, type Mode, type TriageResult } from "./ai/reader";
import { processItem, watchStep, type LoopModels, type Step } from "./ai/loop";
import { ensureSignedIn, loadSettings, type Settings } from "./firebase";
import { logItem, startShift } from "./store";
import { appendRow, connectSheet, pendingRows, sheetUrl } from "./sheet";
import { renderAnswer, renderRow, renderTally } from "./view";
import { checkRecallsAtShiftStart, makeRecallModel, settle, type Found, type Notice } from "./recall";
import recallControl from "../../shared/recall-control.json";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = $("status");
const toolStatus = $("toolStatus");
const still = $<HTMLImageElement>("still");
const modeSel = $<HTMLSelectElement>("mode");
const todayInput = $<HTMLInputElement>("today");
const video = $<HTMLVideoElement>("video");
const readBtn = $<HTMLButtonElement>("read");
const batchBtn = $<HTMLButtonElement>("batch");
const files = $<HTMLInputElement>("files");
const promptEl = $("prompt");
const log = $("log");
const answer = $("answer");
const tally = $("tally");

// Plain names for the three ways of reading, for status lines (charter law 14).
const MODE_WORDS: Record<string, string> = {
  prefer_on_device: "on this laptop first",
  only_on_device: "on this laptop only",
  only_in_cloud: "in the cloud only",
};

video.addEventListener("playing", () => document.body.classList.add("live"));

todayInput.value = new Date().toISOString().slice(0, 10);

// Said plainly on screen, so a volunteer knows the pause is the cloud quota, not a crash.
setRateLimitListener((ms) => {
  promptEl.textContent = `The cloud reader asked to slow down. Waiting ${Math.round(ms / 1000)} s, then retrying.`;
});

interface Logged {
  file?: string;
  at: string;
  mode: Mode;
  step: Step;
}
const results: Logged[] = [];
let models: LoopModels | null = null;
let settings: Settings | null = null;
let shift: { id: string; uid: string } | null = null;
let shiftInfo: Parameters<typeof startShift>[0] | null = null;
let pendingTurn: Step | null = null;

function buildModels(mode: Mode, cloudModel: string): LoopModels {
  return {
    hybrid: { model: makeModel(mode, cloudModel), mode },
    // On-device only means nothing leaves the laptop, including the hand-off for hard reads.
    cloud:
      mode === InferenceMode.ONLY_ON_DEVICE
        ? null
        : { model: makeModel(InferenceMode.ONLY_IN_CLOUD, cloudModel), mode: InferenceMode.ONLY_IN_CLOUD },
    // The product's hybrid: Gemini Nano triages every photo on the laptop, the cloud reads dates.
    triage: mode === InferenceMode.PREFER_ON_DEVICE && browserHasOnDeviceModel() ? { model: makeTriageModel() } : null,
  };
}

// Gemini Nano's first call after Chrome starts can take minutes (457.9 s on the live site,
// 2026-11-19), so the laptop check warms up in the background on a blank frame and items go to
// the cloud until it answers. Nobody waits on a cold model.
let laptopWarm = false;
let warming: Promise<void> | null = null;

function liveModels(mode: Mode, cloudModel: string): LoopModels {
  const m = buildModels(mode, cloudModel);
  const triage = m.triage;
  if (triage && !laptopWarm) {
    m.triage = null;
    warming ??= (async () => {
      const blank = document.createElement("canvas");
      blank.width = blank.height = 64;
      blank.getContext("2d")!.fillRect(0, 0, 64, 64);
      const t0 = performance.now();
      try {
        await triageItem(triage.model, blank.toDataURL("image/jpeg", 0.8).split(",")[1]);
        laptopWarm = true;
        console.info(`laptop check warm after ${Math.round((performance.now() - t0) / 1000)} s`);
        if (models && models.hybrid.mode === InferenceMode.PREFER_ON_DEVICE) models.triage = triage;
        showShiftLine();
      } catch (e) {
        console.error("laptop check did not start", e);
        showShiftLine("This laptop's reader did not start, so items are read in the cloud.");
      }
    })();
  }
  return m;
}

function showShiftLine(note?: string): void {
  if (!settings) return;
  const mode = models?.hybrid.mode ?? modeSel.value;
  const sortDay = new Date(todayInput.value + "T12:00:00").toLocaleDateString("en-CA", { weekday: "long", day: "numeric", month: "long" });
  const warmingUp = mode === InferenceMode.PREFER_ON_DEVICE && browserHasOnDeviceModel() && !laptopWarm;
  const how = note ?? (warmingUp ? "This laptop's reader is warming up, so items are read in the cloud for now." : `Reading ${MODE_WORDS[mode] ?? mode}.`);
  status.textContent = `${settings.foodBankName}, sorting ${sortDay}. ${how}`;
}

async function describeOnDevice(): Promise<string> {
  const lm = (globalThis as unknown as { LanguageModel?: { availability: (o?: object) => Promise<string> } }).LanguageModel;
  if (!lm) return "on-device: not in this browser (cloud fallback)";
  try {
    return "on-device: " + (await lm.availability({ expectedInputs: [{ type: "image" }, { type: "text", languages: ["en"] }] }));
  } catch (e) {
    return "on-device: " + (e as Error).message;
  }
}

describeOnDevice().then((s) => (status.textContent = s.endsWith("available") ? "Ready. This laptop can read items on its own." : "Ready. Items are read in the cloud in this browser."));

// Without Chrome's on-device model the SDK sends every read to the cloud, whatever the mode.
// Say so where a volunteer will see it, and take "On-device only" off the menu.
if (!browserHasOnDeviceModel()) {
  const note = $("browserNote");
  note.textContent =
    "This browser has no on-device model, so every read here goes to the cloud. To read on this laptop instead, open this page in Chrome with Gemini Nano turned on.";
  note.hidden = false;
  const onlyOnDevice = modeSel.querySelector<HTMLOptionElement>('option[value="only_on_device"]');
  if (onlyOnDevice) {
    onlyOnDevice.disabled = true;
    onlyOnDevice.textContent += " (not in this browser)";
  }
}

/** Signs in, loads this food bank's settings and gets the readers ready. No camera yet. */
async function prepare(): Promise<string> {
  const mode = modeSel.value as Mode;
  status.textContent = "Starting the shift";
  const uid = await ensureSignedIn();
  settings = await loadSettings();
  models = liveModels(mode, settings.cloudModel);
  if (mode !== InferenceMode.ONLY_IN_CLOUD) {
    // Never waited on: in a cold Chrome this took over four minutes (2026-11-20), and a
    // volunteer with a can in hand cannot wait. Items go to the cloud until the laptop is ready.
    models.hybrid.model
      .initializeDeviceModel((p) => p < 1 && showShiftLine(`Downloading this laptop's reader, ${Math.round(p * 100)}%. Items are read in the cloud for now.`))
      .catch(() => showShiftLine("This laptop cannot read on its own right now, so items go to the cloud."));
  }
  const onDevice = await describeOnDevice();
  // The shift record is written with the first logged item, so a measurement batch that
  // never logs anything leaves no empty shift in the food bank's data.
  shiftInfo = { foodBankId: settings.foodBankId, uid, mode, onDevice, cloudModel: settings.cloudModel };
  shift = null;
  showShiftLine();
  batchBtn.disabled = false;
  compareBtn.disabled = false;
  recallControlBtn.disabled = false;
  return uid;
}

$("start").addEventListener("click", async () => {
  const uid = await prepare();
  document.body.classList.add("started");
  await openCamera(localStorageGet("camera"));
  await listCameras();
  readBtn.disabled = false;
  // Watching the camera every second is only affordable, and only private, on the laptop itself.
  if (browserHasOnDeviceModel() && modeSel.value === InferenceMode.PREFER_ON_DEVICE) {
    handsBtn.disabled = false;
  } else {
    handsBtn.title = "Hands-free needs this laptop's own reader (Chrome with Gemini Nano). Here, press Read item.";
    promptEl.textContent = "Hands-free is off here: it needs Gemini Nano on this laptop, so the camera is never streamed to the cloud. Press Read item.";
  }
  sheetBtn.disabled = false;
  showSheetStatus();
  runRecallCheck(uid);
});

// Sample photos: real pantry photos read through the same loop, for anyone with no item to
// hand or no webcam. Like the batch, a sample is never written to a food bank's item log.
// The first two are one item: the front of a broth carton (name, no date), then its top (date,
// no name). The third is a yogurt tub lid.
const SAMPLES = ["20261115_112419.jpg", "20261115_112427.jpg", "20261115_112446.jpg"];
let nextSample = 0;
const sampleBtn = $<HTMLButtonElement>("sample");
const sampleNote = $("sampleNote");

async function readSample(): Promise<void> {
  sampleBtn.disabled = true;
  sampleNote.textContent = "Reading a sample photo";
  try {
    if (!models || !settings) await prepare();
    const img = new Image();
    img.src = `/testset/pantry-2026-11-15/${SAMPLES[nextSample++ % SAMPLES.length]}`;
    await img.decode();
    const frame = toJpegBase64(img, img.naturalWidth, img.naturalHeight);
    const small = toJpegBase64(img, img.naturalWidth, img.naturalHeight, 512).b64;
    const step = await processItem(models!, frame.b64, {
      today: todayInput.value,
      policy: settings!.policy,
      smallJpeg: small,
      previous: pendingTurn ? pendingTurn.reads : undefined,
    });
    pendingTurn = step.kind === "need_date_photo" ? step : null;
    results.push({ file: "sample", at: new Date().toISOString(), mode: models!.hybrid.mode, step });
    render(step, frame.url, "sample");
  } catch (e) {
    sampleNote.textContent = readFailure(e);
    document.title = "Keep Until: read failed";
    console.error(e);
    return;
  } finally {
    sampleBtn.disabled = false;
  }
  sampleBtn.textContent = pendingTurn ? "Turn the sample item" : "Try another sample photo";
  sampleNote.textContent = pendingTurn
    ? "The next sample is the same carton, turned."
    : "Real photos from my pantry. Samples are never added to a food bank's log.";
}
sampleBtn.addEventListener("click", readSample);
if (new URLSearchParams(location.search).has("sample")) readSample();

const recallNote = $("recallNote");
const recallControlBtn = $<HTMLButtonElement>("recallControl");

function recallRow(f: Found, what: string): string[] {
  return [
    new Date().toLocaleString("en-CA"), f.item.product, f.item.brand, "Recall notice", f.item.dateText ?? "", "",
    what, "", `${f.notice.title}. ${f.settled.why} ${f.notice.url}`, "", f.settled.source === "on_device" ? "this laptop" : "cloud", f.item.id,
  ];
}

// The recall watch, settled at shift start: what to pull before anything else, in words.
async function runRecallCheck(uid: string): Promise<void> {
  if (!settings) return;
  try {
    const r = await checkRecallsAtShiftStart(settings.foodBankId, uid, makeRecallModel(settings.cloudModel));
    const lines: string[] = [];
    for (const f of r.toPull) lines.push(`Pull ${f.item.brand} ${f.item.product}: ${f.notice.title}.`);
    for (const f of r.toCheck) lines.push(`Check the lot code on ${f.item.brand} ${f.item.product} against "${f.notice.title}".`);
    const w = r.watch;
    const checked = w?.recallsInWindow !== undefined ? `${w.recallsInWindow} food recalls from the past year checked against ${w.itemsWatched ?? 0} kept items` : "Recall watch has not run yet";
    const cleared = r.cleared ? ` ${r.cleared} brand ${r.cleared === 1 ? "match was" : "matches were"} a different product.` : "";
    recallNote.replaceChildren(lines.length ? `Recall check: ${lines.join(" ")}` : `Recall check: nothing to pull. ${checked}.${cleared}`);
    recallNote.classList.toggle("recall-note--act", lines.length > 0);
    recallNote.hidden = false;
    if (sheetUrl()) {
      for (const f of r.toPull.filter((x) => x.fresh)) appendRow(recallRow(f, "Pull: recalled"));
      for (const f of r.toCheck.filter((x) => x.fresh)) appendRow(recallRow(f, "Check the lot code"));
    }
  } catch (e) {
    recallNote.textContent = "Recall check could not run this shift. It runs again at the next shift start.";
    recallNote.hidden = false;
    console.error(e);
  }
}

// The recall control set: eight real notices, each with an item under the same brand, expected
// outcomes registered before the first run (shared/recall-control.json). The brand rule alone
// would pull all eight; the file records what the model decided against that.
recallControlBtn.addEventListener("click", async () => {
  if (!settings) return;
  recallControlBtn.disabled = true;
  const model = makeRecallModel(settings.cloudModel);
  const runs: unknown[] = [];
  for (const [i, c] of recallControl.cases.entries()) {
    toolStatus.textContent = `Recall control set: case ${i + 1} of ${recallControl.cases.length}`;
    try {
      const s = await settle(model, c.recall as Notice, c.item);
      runs.push({ id: c.id, expected: c.expected, rule: "pull", model: s.decision, why: s.why, source: s.source, ms: s.ms });
    } catch (e) {
      runs.push({ id: c.id, expected: c.expected, rule: "pull", error: (e as Error).message });
    }
  }
  const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), cloudModel: settings.cloudModel, registered: recallControl.registered, runs }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "keep-until-recall-control.json";
  a.click();
  toolStatus.textContent = "Recall control set done. The results file is in your downloads.";
  recallControlBtn.disabled = false;
});

const sheetBtn = $<HTMLButtonElement>("sheet");
const sheetStatus = $("sheetStatus");

function showSheetStatus(note = ""): void {
  const url = sheetUrl();
  const waiting = pendingRows();
  sheetStatus.replaceChildren();
  if (url) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "open the sheet";
    sheetStatus.append("Stock sheet connected: ", a);
  }
  const extra = [waiting ? `${waiting} row${waiting > 1 ? "s" : ""} waiting to be sent` : "", note].filter(Boolean).join(", ");
  if (extra) sheetStatus.append((url ? ". " : "") + extra.charAt(0).toUpperCase() + extra.slice(1));
}

sheetBtn.addEventListener("click", async () => {
  if (!settings) return;
  sheetBtn.disabled = true;
  try {
    const { uid } = await connectSheet(settings.foodBankName);
    // Signing in with Google can change the user id when that Google account already had
    // one; later items are logged under the id Firestore now sees.
    if (shiftInfo && shiftInfo.uid !== uid) {
      shiftInfo = { ...shiftInfo, uid };
      shift = null;
    }
    sheetBtn.innerHTML = 'Reconnect <span class="wide">the </span>sheet';
    showSheetStatus();
  } catch (e) {
    showSheetStatus("could not connect: " + (e as Error).message);
  } finally {
    sheetBtn.disabled = false;
  }
});

const compareBtn = $<HTMLButtonElement>("compare");

// The ablation in one click: the same sample photos through on-device only (nothing leaves the
// laptop), prefer on-device (the product) and cloud only. Downloads one results file that
// scripts/grade_run.py grades against results/labels/.
compareBtn.addEventListener("click", async () => {
  if (!settings) return;
  compareBtn.disabled = true;
  const set = "pantry-2026-11-15";
  const manifest = (await (await fetch(`/testset/${set}/manifest.json`)).json()) as { files: string[] };
  // On-device only is skipped (and recorded as skipped) in a browser that cannot run it.
  const modes: Mode[] = browserHasOnDeviceModel()
    ? [InferenceMode.ONLY_ON_DEVICE, InferenceMode.PREFER_ON_DEVICE, InferenceMode.ONLY_IN_CLOUD]
    : [InferenceMode.PREFER_ON_DEVICE, InferenceMode.ONLY_IN_CLOUD];
  const runs: Logged[] = [];
  for (const mode of modes) {
    const m = buildModels(mode, settings.cloudModel);
    if (mode !== InferenceMode.ONLY_IN_CLOUD) {
      try {
        await m.hybrid.model.initializeDeviceModel();
      } catch {
        // On a browser without Gemini Nano the on-device-only run records the failure per photo.
      }
    }
    for (const [i, file] of manifest.files.entries()) {
      toolStatus.textContent = `Comparing, ${MODE_WORDS[mode] ?? mode}: photo ${i + 1} of ${manifest.files.length}`;
      const img = new Image();
      img.src = `/testset/${set}/${file}`;
      await img.decode();
      const frame = toJpegBase64(img, img.naturalWidth, img.naturalHeight);
      try {
        const step = await processItem(m, frame.b64, { today: todayInput.value, policy: settings.policy });
        runs.push({ file, at: new Date().toISOString(), mode, step });
        render(step, frame.url, `${mode} · ${file}`);
      } catch (e) {
        runs.push({ file, at: new Date().toISOString(), mode, step: { kind: "no_item", reads: [], route: "error: " + (e as Error).message } });
      }
    }
  }
  toolStatus.textContent = `Comparison done: ${manifest.files.length} photos, read ${modes.length} ways. The results file is in your downloads.`;
  const blob = new Blob(
    [JSON.stringify({ exported: new Date().toISOString(), set, sortDate: todayInput.value, cloudModel: settings.cloudModel, onDevice: await describeOnDevice(), results: runs }, null, 2)],
    { type: "application/json" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `keep-until-comparison-${set}.json`;
  a.click();
  compareBtn.disabled = false;
});

// Dev server only: three narrower on-device jobs over the sample photos, to decide what
// Gemini Nano should do in this app (see src/dev/ondevice-experiment.ts).
const experimentBtn = $<HTMLButtonElement>("experiment");
if (import.meta.env.DEV && browserHasOnDeviceModel()) {
  experimentBtn.hidden = false;
  experimentBtn.addEventListener("click", async () => {
    experimentBtn.disabled = true;
    const { runExperiment, VARIANTS } = await import("./dev/ondevice-experiment");
    const set = "pantry-2026-11-15";
    const manifest = (await (await fetch(`/testset/${set}/manifest.json`)).json()) as { files: string[] };
    const rows = await runExperiment(set, manifest.files, (s) => (toolStatus.textContent = s));
    toolStatus.textContent = `On-device experiment done: ${rows.length} reads`;
    const blob = new Blob(
      [JSON.stringify({ exported: new Date().toISOString(), set, onDevice: await describeOnDevice(), variants: VARIANTS.map((v) => ({ id: v.id, prompt: v.prompt })), rows }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `keep-until-ondevice-experiment-${set}.json`;
    a.click();
    experimentBtn.disabled = false;
  });
}

const cameraSel = $<HTMLSelectElement>("camera");

function localStorageGet(key: string): string | undefined {
  try {
    return localStorage.getItem("keepuntil." + key) ?? undefined;
  } catch {
    return undefined;
  }
}

function localStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem("keepuntil." + key, value);
  } catch {
    // Private windows can refuse storage; the choice just is not remembered.
  }
}

// ?clip=1: a 70-second recording of real pantry photos (an empty table, a carton's front, its
// top, the table again, a yogurt lid) plays in the camera's place, so hands-free can be tried
// with no item and no webcam. Like the samples, nothing read from it is written to a food bank's log.
const clipMode = new URLSearchParams(location.search).has("clip");

async function openCamera(deviceId?: string): Promise<void> {
  (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
  if (clipMode) {
    video.srcObject = null;
    video.src = "/testset/handsfree-clip.webm";
    video.muted = true;
    video.autoplay = false;
    await new Promise((r) => video.addEventListener("loadeddata", r, { once: true }));
    promptEl.textContent = "A recorded clip stands in for the camera. It plays when hands-free starts, and nothing from it is logged.";
    return;
  }
  try {
    // Date stamps are small print, so ask for full HD; the browser falls back if it cannot.
    // With no saved choice, ask for the back camera: phones otherwise open the selfie camera.
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }),
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    promptEl.textContent = "";
    // A phone used as a webcam (Windows Phone Link) sends no picture while the phone is locked.
    setTimeout(() => {
      if (video.srcObject && !video.videoWidth) {
        promptEl.textContent = "This camera sends no picture. If it is a phone, wake its screen, or pick another camera.";
      }
    }, 3000);
  } catch {
    promptEl.textContent = "No camera found. You can still run saved photos from the tools below.";
  }
}

async function listCameras(): Promise<void> {
  if (clipMode) return; // the clip stands in for the camera
  const current = (video.srcObject as MediaStream | null)?.getVideoTracks()[0]?.getSettings().deviceId;
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
  cameraSel.replaceChildren(
    ...cams.map((c, i) => {
      const o = document.createElement("option");
      o.value = c.deviceId;
      o.textContent = c.label || `Camera ${i + 1}`;
      o.selected = c.deviceId === current;
      return o;
    }),
  );
}

cameraSel.addEventListener("change", async () => {
  localStorageSet("camera", cameraSel.value);
  await openCamera(cameraSel.value);
});

modeSel.addEventListener("change", () => {
  if (models && settings) {
    models = liveModels(modeSel.value as Mode, settings.cloudModel);
    showShiftLine();
  }
});

/**
 * Why a read failed, in the volunteer's words. When App Check cannot verify the browser,
 * Google answers the read with "genai config not found" (seen on the live site from an
 * automated browser, 2026-11-19), which is not the volunteer's to fix by holding still.
 */
function readFailure(e: unknown): string {
  const m = (e as Error)?.message ?? "";
  if (/config not found|attestation|app ?check|PERMISSION_DENIED/i.test(m)) {
    return "Google could not verify this browser, so it will not read items here. Try Chrome without extensions or private mode, or the sample photos under Testing tools.";
  }
  if (/prepayment|RESOURCE_EXHAUSTED|429/i.test(m)) return "The cloud reader is busy or out of credit. Wait a minute and press Read item again.";
  if (!navigator.onLine) return "No connection. Items read on this laptop still work; the cloud reads will need Wi-Fi.";
  return "That read did not go through. Hold the item steady and press Read item again.";
}

function toJpegBase64(source: CanvasImageSource, w: number, h: number, maxSide = 1024): { b64: string; url: string } {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.88);
  return { b64: url.split(",")[1], url };
}

const narrow = window.matchMedia("(max-width: 860px)");
const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

function render(step: Step, thumb: string, _label: string): void {
  renderAnswer(answer, step);
  // The tab title carries the last answer, so it reads out and shows in the tab strip.
  document.title = `Keep Until: ${[...(answer.querySelector(".band")?.children ?? [])].map((c) => c.textContent).join(" ")}`;
  // Without a live camera (saved photos), the item just read stays in the camera's place.
  if (!video.videoWidth) {
    still.src = thumb;
    still.hidden = false;
    const box = still.parentElement as HTMLElement;
    box.style.setProperty("--still", `url("${thumb}")`);
    box.classList.add("has-still");
    promptEl.textContent = "";
  }
  // At phone width the answer sits under the camera; bring it into view so the volunteer
  // never has to scroll with an item in their hand.
  if (narrow.matches && answer.getBoundingClientRect().top > window.innerHeight * 0.55) {
    answer.scrollIntoView({ block: "start", behavior: calm.matches ? "auto" : "smooth" });
  }
  const row = renderRow(step, thumb);
  if (row) log.prepend(row);
  renderTally(tally, [...results.map((r) => r.step)]);
}

readBtn.addEventListener("click", () => readCamera());

/** Reads the item in front of the camera and logs it. `triaged`: the laptop already checked this frame. */
async function readCamera(given?: { frame: { b64: string; url: string }; small: string; triaged: TriageResult }): Promise<Step | null> {
  if (!models || !settings || !shiftInfo || !video.videoWidth) return null;
  readBtn.disabled = true;
  const frame = given?.frame ?? toJpegBase64(video, video.videoWidth, video.videoHeight);
  const small = given?.small ?? toJpegBase64(video, video.videoWidth, video.videoHeight, 512).b64;
  try {
    const step = await processItem(models, frame.b64, {
      today: todayInput.value,
      policy: settings.policy,
      previous: pendingTurn ? pendingTurn.reads : undefined,
      smallJpeg: small,
      triaged: given?.triaged,
    });
    pendingTurn = step.kind === "need_date_photo" ? step : null;
    promptEl.textContent = "";
    results.push({ at: new Date().toISOString(), mode: models.hybrid.mode, step });
    if (step.kind === "verdict" && !clipMode) {
      shift ??= { id: startShift(shiftInfo), uid: shiftInfo.uid };
      const logged = logItem(settings.foodBankId, shift.id, shift.uid, step, settings.policy);
      // The item also lands in the food bank's own sheet; if it cannot yet, it waits.
      if (sheetUrl()) appendRow(logged.sheetRow).then((waiting) => showSheetStatus(waiting ? "" : "row added"));
    }
    render(step, frame.url, "camera");
    return step;
  } catch (e) {
    promptEl.textContent = readFailure(e);
    console.error(e);
    return null;
  } finally {
    readBtn.disabled = handsFree;
  }
}

// Hands-free. Gemini Nano on this laptop looks at the camera every moment it is free, and the
// cloud is asked only when an item's date faces the camera. A volunteer with a can in each hand
// never touches the keyboard: hold it up, turn it when asked, put it down, next item.
const handsBtn = $<HTMLButtonElement>("handsfree");
const watching = $("watching");
let handsFree = false;
let ready = true; // the table has been clear since the last item was settled
let lastReadSig: Uint8Array | null = null;
const watchCounts = { looks: 0, cloudReads: 0 };
const lookMs: number[] = [];
const watchLog: { at: number; saw: string; ms: number }[] = [];

/** A 32x24 grey thumbnail: enough to tell whether the item in front of the camera has moved. */
function signature(): Uint8Array {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 24;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(video, 0, 0, 32, 24);
  const px = g.getImageData(0, 0, 32, 24).data;
  const out = new Uint8Array(32 * 24);
  for (let i = 0; i < out.length; i++) out[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3;
  return out;
}
function moved(a: Uint8Array, b: Uint8Array | null): boolean {
  if (!b) return true;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  return d / a.length > 10;
}

function showWatching(words: string): void {
  watching.textContent = words;
  watching.hidden = false;
}

async function watchLoop(): Promise<void> {
  while (handsFree) {
    if (clipMode && video.ended) {
      handsFree = false;
      handsBtn.setAttribute("aria-pressed", "false");
      handsBtn.textContent = "Hands-free";
      readBtn.disabled = false;
      const answers = results.map((r) => (r.step.kind === "verdict" ? r.step.verdict.decision : r.step.kind).toLowerCase().replace(/_/g, " "));
      const looks = [...lookMs].sort((a, b) => a - b);
      const median = looks.length ? (looks[Math.floor(looks.length / 2)] / 1000).toFixed(1) : "?";
      const summary = `${watchCounts.looks} looks on this laptop (median ${median} s), ${watchCounts.cloudReads} sent to the cloud: ${answers.join(", ") || "none"}`;
      promptEl.textContent = `Clip finished: ${summary}.`;
      document.title = `Keep Until clip: ${summary} | ${watchLog.map((w) => `${w.at}s ${w.saw}`).join(", ")}`;
      console.info("hands-free clip", JSON.stringify({ ...watchCounts, lookMs, answers, timeline: watchLog }));
      break;
    }
    const triage = models?.triage;
    if (!triage || !video.videoWidth) {
      showWatching(laptopWarm ? "Waiting for the camera" : "This laptop's reader is warming up");
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    // The clip starts once the laptop's reader is warm, like a volunteer starting on the first item.
    if (clipMode && video.paused && !video.ended) await video.play().catch(() => undefined);
    const small = toJpegBase64(video, video.videoWidth, video.videoHeight, 512);
    const sig = signature();
    let tr: TriageResult;
    try {
      tr = await triageItem(triage.model, small.b64);
      watchCounts.looks++;
      lookMs.push(tr.ms);
    } catch (e) {
      showWatching("This laptop could not check that frame. Trying again.");
      console.error(e);
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    if (!handsFree) break;
    const tally = `${watchCounts.looks} looks on this laptop, ${watchCounts.cloudReads} sent to the cloud`;
    let next = watchStep(tr.triage, ready);
    // The same view as the last read is not a new photo: a person turns it, or takes it away.
    if (next === "read" && !moved(sig, lastReadSig)) next = pendingTurn ? "turn" : "next";
    watchLog.push({ at: Math.round(video.currentTime * 10) / 10, saw: next, ms: tr.ms });
    if (next === "clear") {
      ready = true;
      lastReadSig = null;
      showWatching(`Watching on this laptop. Hold up the next item. ${tally}`);
    } else if (next === "next") {
      showWatching(`Done. Put it down for the next item. ${tally}`);
    } else if (next === "turn") {
      showWatching(`Turn it so the date faces the camera. Nothing sent yet. ${tally}`);
      promptEl.textContent = "Turn it so the date faces the camera.";
    } else {
      showWatching("Date in view. Reading it in the cloud.");
      watchCounts.cloudReads++;
      lastReadSig = sig;
      const frame = toJpegBase64(video, video.videoWidth, video.videoHeight);
      const step = await readCamera({ frame, small: small.b64, triaged: tr });
      // An item asked to be turned stays this item; anything settled waits for the table to clear.
      ready = step?.kind === "need_date_photo";
    }
  }
  watching.hidden = true;
}

handsBtn.addEventListener("click", () => {
  handsFree = !handsFree;
  handsBtn.setAttribute("aria-pressed", String(handsFree));
  handsBtn.textContent = handsFree ? "Hands-free on" : "Hands-free";
  readBtn.disabled = handsFree;
  if (handsFree) {
    ready = true;
    lastReadSig = null;
    if (clipMode && video.ended) video.currentTime = 0;
    watchLoop();
  } else if (clipMode) {
    video.pause();
  }
});

// ?clip=1 runs the whole thing with no hands: start the shift, then watch the clip hands-free.
if (clipMode) {
  $("start").click();
  let tries = 0;
  const go = setInterval(() => {
    if (++tries > 120) clearInterval(go); // no laptop reader here: the button says why
    else if (!handsBtn.disabled) {
      clearInterval(go);
      handsBtn.click();
    }
  }, 500);
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  return img;
}

// The batch run is the measurement run. Its results go to the exported file only, never
// into a food bank's live item log.
batchBtn.addEventListener("click", async () => {
  if (!models || !settings || !files.files?.length) return;
  batchBtn.disabled = true;
  const list = [...files.files];
  let failure = "";
  for (const [i, file] of list.entries()) {
    toolStatus.textContent = `Reading photo ${i + 1} of ${list.length}`;
    const img = await loadImage(file);
    const frame = toJpegBase64(img, img.naturalWidth, img.naturalHeight);
    const small = toJpegBase64(img, img.naturalWidth, img.naturalHeight, 512).b64;
    try {
      const step = await processItem(models, frame.b64, { today: todayInput.value, policy: settings.policy, smallJpeg: small });
      results.push({ file: file.name, at: new Date().toISOString(), mode: models.hybrid.mode, step });
      render(step, frame.url, file.name);
    } catch (e) {
      results.push({ file: file.name, at: new Date().toISOString(), mode: models.hybrid.mode, step: { kind: "need_date_photo", reads: [], route: "error: " + (e as Error).message } });
      failure = readFailure(e);
    }
  }
  toolStatus.textContent = `Done: ${list.length} ${list.length === 1 ? "photo" : "photos"} read ${MODE_WORDS[models.hybrid.mode] ?? ""}${failure ? `. ${failure}` : ""}`;
  batchBtn.disabled = false;
});

$("export").addEventListener("click", () => {
  const blob = new Blob(
    [JSON.stringify({ exported: new Date().toISOString(), cloudModel: settings?.cloudModel, policy: settings?.policy, results }, null, 2)],
    { type: "application/json" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `keep-until-results-${Date.now()}.json`;
  a.click();
});
