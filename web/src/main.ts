import "./styles.css";
import { InferenceMode } from "firebase/ai";
import { browserHasOnDeviceModel, makeModel, makeTriageModel, setRateLimitListener, triageItem, type Mode, type TriageResult } from "./ai/reader";
import { afterRead, printedName, processItem, watchStep, WATCH_START, type LoopModels, type Step, type WatchState } from "./ai/loop";
import { ensureSignedIn, loadSettings, type Settings } from "./firebase";
import { logItem, startShift } from "./store";
import { appendRow, connectSheet, pendingRows, sheetUrl } from "./sheet";
import { renderAnswer, renderRow, renderTally, spokenAnswer } from "./view";
import { fixedLine, type Spoken } from "./voice";
import { checkRecallsAtShiftStart, makeRecallModel, settle, type Found, type Notice } from "./recall";
import recallControl1 from "../../shared/recall-control.json";
import recallControl2 from "../../shared/recall-control-2.json";

// Both pre-registered sets, run together: the first (2026-11-19) and the harder second (2026-11-22).
const recallSets = [recallControl1, recallControl2];

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
let laptopFailed = false; // this browser has the API but the model cannot run here (old laptop, no disk space)
let warming: Promise<void> | null = null;

function liveModels(mode: Mode, cloudModel: string): LoopModels {
  const m = buildModels(mode, cloudModel);
  // In the product the laptop only checks; the full read is the cloud's, warm or not.
  m.readInCloud = mode === InferenceMode.PREFER_ON_DEVICE;
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
        laptopFailed = true;
        showShiftLine("This laptop's reader did not start, so items are read in the cloud.");
        syncHandsFree();
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
    "This browser has no on-device model, so every read here goes to the cloud. To read on this laptop instead, open this page in Chrome with Gemini Nano turned on. To see the laptop's half now: ";
  const watch = document.createElement("a");
  watch.href = "?replay=1";
  watch.textContent = "watch a hands-free run recorded on Gemini Nano";
  note.append(watch, ".");
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
  syncHandsFree();
  sheetBtn.disabled = false;
  showSheetStatus();
  runRecallCheck(uid);
});

// Sample photos: real pantry photos read through the same loop, for anyone with no item to
// hand or no webcam. Like the batch, a sample is never written to a food bank's item log.
// The first two are one item: the front of a broth carton (name, no date), then its top (date,
// no name). The third is a yogurt tub lid. The fourth is someone else's photo, from Open Food
// Facts: a jar of peanut butter dated 2021, which the chart says to discard. Each sample has the
// line shown under the button once it has been read.
const PANTRY = "Real photos from my pantry. Samples are never added to a food bank's log.";
const SAMPLES = [
  { src: "/testset/pantry-2026-11-15/20261115_112419.jpg", after: "The next sample is the same carton, turned." },
  { src: "/testset/pantry-2026-11-15/20261115_112427.jpg", after: PANTRY },
  { src: "/testset/pantry-2026-11-15/20261115_112446.jpg", after: "Next: a jar of peanut butter dated 2021, from Open Food Facts." },
  {
    src: "/testset/off/0056664013115-2.jpg",
    after: "Peanut butter photo: Open Food Facts contributors, CC BY-SA 4.0. Samples are never added to a food bank's log.",
  },
];
let nextSample = 0;
const sampleBtn = $<HTMLButtonElement>("sample");
const sampleNote = $("sampleNote");
// The sample carton's pending turn is its own: a real item at the camera is never read as the
// back of a sample, and a sample never uses up a real item's turn.
let samplePending: Step | null = null;

async function readSample(): Promise<void> {
  let sample = SAMPLES[0];
  sampleBtn.disabled = true;
  sampleNote.textContent = "Reading a sample photo";
  answer.classList.add("stale");
  try {
    if (!models || !settings) await prepare();
    const img = new Image();
    const index = nextSample % SAMPLES.length;
    sample = SAMPLES[index];
    img.src = sample.src;
    await img.decode();
    const frame = toJpegBase64(img, img.naturalWidth, img.naturalHeight);
    const small = toJpegBase64(img, img.naturalWidth, img.naturalHeight, 512).b64;
    // Only the carton's top (the second photo) is read together with its front. Matched by
    // position, not by the last answer: the yogurt is never read as the back of the carton.
    const step = await processItem(models!, frame.b64, {
      today: todayInput.value,
      policy: settings!.policy,
      smallJpeg: small,
      previous: index === 1 && samplePending ? samplePending.reads : undefined,
    });
    // A failed read throws above and the same photo is tried again on the next press.
    nextSample++;
    samplePending = index === 0 && step.kind === "need_date_photo" ? step : null;
    results.push({ file: "sample", at: new Date().toISOString(), mode: models!.hybrid.mode, step });
    render(step, frame.url, "sample");
    // Said aloud as at the sort table, unless the volunteer turned the voice off: the one way to
    // hear it with no camera and no on-device model.
    if (localStorageGet("speak") !== "off") speakBox.checked = true;
    say(spokenAnswer(step));
  } catch (e) {
    sampleNote.textContent = readFailure(e);
    document.title = "Keep Until: read failed";
    console.error(e);
    return;
  } finally {
    sampleBtn.disabled = false;
    answer.classList.remove("stale");
  }
  sampleBtn.textContent = samplePending ? "Turn the sample item" : "Try another sample photo";
  sampleNote.textContent = sample.after;
}
sampleBtn.addEventListener("click", readSample);
// ?sample=1 reads the first sample on load. ?sample=all reads all four in turn (the carton's
// front, its top, the yogurt, the peanut butter) and puts the answers in the window title: the check that the
// public path works end to end, run five times before submitting.
const sampleParam = new URLSearchParams(location.search).get("sample");
if (sampleParam === "all") {
  (async () => {
    const answers: string[] = [];
    for (let i = 0; i < SAMPLES.length; i++) {
      const before = results.length;
      await readSample();
      if (results.length === before) {
        answers.push("read failed");
        break;
      }
      answers.push(document.title.replace("Keep Until: ", ""));
    }
    document.title = `Keep Until samples: ${answers.join(" | ")}`;
  })();
} else if (sampleParam !== null) readSample();

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
    for (const f of r.toPull) lines.push(`Pull ${printedName(f.item.brand, f.item.product)}: ${f.notice.title}.`);
    for (const f of r.toCheck) lines.push(`Check the lot code on ${printedName(f.item.brand, f.item.product)} against "${f.notice.title}".`);
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
  const cases = recallSets.flatMap((set) => set.cases.map((c) => ({ ...c, registered: set.registered })));
  for (const [i, c] of cases.entries()) {
    toolStatus.textContent = `Recall control sets: case ${i + 1} of ${cases.length}`;
    try {
      const s = await settle(model, c.recall as Notice, c.item);
      runs.push({ id: c.id, registered: c.registered, expected: c.expected, model: s.decision, why: s.why, source: s.source, ms: s.ms });
    } catch (e) {
      runs.push({ id: c.id, registered: c.registered, expected: c.expected, error: (e as Error).message });
    }
  }
  const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), cloudModel: settings.cloudModel, sets: recallSets.map((x) => x.registered), runs }, null, 2)], { type: "application/json" });
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
// ?clip=long plays the longer one: all 16 pantry photos, 8 items, as shared/handsfree-control.json lists them.
const clipParam = new URLSearchParams(location.search).get("clip");
const clipMode = clipParam !== null;
const clipFile = clipParam === "long" ? "/testset/handsfree-clip-long.webm" : "/testset/handsfree-clip.webm";

async function openCamera(deviceId?: string): Promise<void> {
  (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
  if (clipMode) {
    video.srcObject = null;
    video.src = clipFile;
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
    syncHandsFree();
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

function render(step: Step, thumb: string, label: string): void {
  // Hands-free, the replay and the samples have no Read item press to ask for (a sample is turned
  // with its own button), so their answers never say to press it.
  renderAnswer(answer, step, handsFree || label === "replay" || label === "sample");
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

let reading = false; // one camera read at a time, whoever started it

/**
 * Reads the item in front of the camera and logs it. `given`: hands-free started this read, on a
 * frame the laptop already checked; `patient` is false once two looks have not settled the item.
 */
async function readCamera(given?: { frame: { b64: string; url: string }; small: string; triaged: TriageResult; patient: boolean }): Promise<Step | null> {
  if (reading || !models || !settings || !shiftInfo || !video.videoWidth) return null;
  reading = true;
  readBtn.disabled = true;
  // The last answer steps back while the next item is read: it is about the item before.
  answer.classList.add("stale");
  const frame = given?.frame ?? toJpegBase64(video, video.videoWidth, video.videoHeight);
  const small = given?.small ?? toJpegBase64(video, video.videoWidth, video.videoHeight, 512).b64;
  try {
    const step = await processItem(models, frame.b64, {
      today: todayInput.value,
      policy: settings.policy,
      previous: pendingTurn ? pendingTurn.reads : undefined,
      smallJpeg: small,
      triaged: given?.triaged,
      watching: given ? given.patient : undefined,
      want: pendingTurn?.kind === "need_date_photo" ? pendingTurn.want : undefined,
    });
    // Hands-free: a cloud "nothing there" on one frame does not throw away the face already read.
    if (step.kind === "need_date_photo") pendingTurn = step;
    else if (!(given && step.kind === "no_item")) pendingTurn = null;
    if (!given) {
      // A read by hand counts for hands-free too: switched on next, it will not read this item again.
      lastReadSig = signature();
      watch = afterRead(WATCH_START, step);
    }
    promptEl.textContent = "";
    results.push({ at: new Date().toISOString(), mode: models.hybrid.mode, step });
    if (step.kind === "verdict" && !clipMode) {
      shift ??= { id: startShift(shiftInfo), uid: shiftInfo.uid };
      const logged = logItem(settings.foodBankId, shift.id, shift.uid, step, settings.policy);
      // The item also lands in the food bank's own sheet; if it cannot yet, it waits.
      if (sheetUrl()) appendRow(logged.sheetRow).then((waiting) => showSheetStatus(waiting ? "" : "row added"));
    }
    render(step, frame.url, "camera");
    say(spokenAnswer(step));
    return step;
  } catch (e) {
    promptEl.textContent = readFailure(e);
    console.error(e);
    return null;
  } finally {
    reading = false;
    answer.classList.remove("stale");
    readBtn.disabled = handsFree && laptopWarm;
  }
}

// Hands-free. Gemini Nano on this laptop checks the camera every moment it is free, and the
// cloud is asked only when an item's date faces the camera. A volunteer with a can in each hand
// never touches the keyboard: hold it up, turn it when asked, put it down, next item.
// The rules for when a frame is sent are watchStep and afterRead in ai/loop.ts.
const handsBtn = $<HTMLButtonElement>("handsfree");
const watching = $("watching");
let handsFree = false;
let watchRun = 0; // each switch-on is a new run; a loop from an earlier run stops at its next check
let watch: WatchState = WATCH_START;
let lastReadSig: Uint8Array | null = null;
let failures = 0;
let slowChecks = 0;
const STALE_CHECK_MS = 8000;
const watchCounts = { looks: 0, cloudReads: 0 };
const lookMs: number[] = [];
// `hidden`: the page was covered or in the background during this check (Chrome slows such pages).
// `sees`: what the laptop's check said about the frame (package, date in view, needs the fridge).
const watchLog: { at: number; saw: string; ms: number; hidden?: boolean; sees?: { package: boolean; date: boolean; fridge: boolean } }[] = [];
// Every answer of a clip run, with the clip time it landed at: the record ?replay=1 plays back.
const clipSteps: { at: number; step: Step }[] = [];
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** True when the laptop says it is running on battery. Unknown (no Battery API) counts as plugged in. */
async function onBattery(): Promise<boolean> {
  try {
    const b = await (navigator as unknown as { getBattery?: () => Promise<{ charging: boolean }> }).getBattery?.();
    return b ? !b.charging : false;
  } catch {
    return false;
  }
}

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
  // In clip mode the window title says whether the laptop is watching yet, so a recording can
  // start the moment the run does.
  if (clipMode && !document.title.startsWith("Keep Until clip:")) {
    document.title = models?.triage && video.videoWidth ? "Keep Until: watching" : "Keep Until: warming up";
  }
}

/** Hands-free is offered only where the laptop's own reader can run, and says why where it cannot. */
function syncHandsFree(): void {
  const started = document.body.classList.contains("started");
  const can = browserHasOnDeviceModel() && modeSel.value === InferenceMode.PREFER_ON_DEVICE && !laptopFailed;
  if (!can && handsFree) stopHandsFree();
  handsBtn.disabled = !can || !started;
  handsBtn.title = can ? "" : "Hands-free needs this laptop's own reader (Chrome with Gemini Nano). Here, press Read item.";
  // Never written over another message (a missing camera matters more than this note).
  if (started && !can && !promptEl.textContent) {
    promptEl.textContent = laptopFailed
      ? "This laptop's reader did not start, so hands-free is off. Press Read item."
      : "Hands-free is off here: it needs Gemini Nano on this laptop, so the camera is never streamed to the cloud. Press Read item.";
  }
}

function stopHandsFree(): void {
  handsFree = false;
  watchRun++;
  handsBtn.setAttribute("aria-pressed", "false");
  handsBtn.textContent = "Hands-free";
  readBtn.disabled = reading;
  watching.hidden = true;
  if (clipMode) video.pause();
}

function finishClip(): void {
  stopHandsFree();
  const answers = results.map((r) => (r.step.kind === "verdict" ? r.step.verdict.decision : r.step.kind).toLowerCase().replace(/_/g, " "));
  const looks = [...lookMs].sort((a, b) => a - b);
  const median = looks.length ? (looks[Math.floor(looks.length / 2)] / 1000).toFixed(1) : "?";
  const summary = `${watchCounts.looks} checks on this laptop (median ${median} s), ${watchCounts.cloudReads} sent to the cloud: ${answers.join(", ") || "none"}`;
  promptEl.textContent = `Clip finished: ${summary}.`;
  document.title = `Keep Until clip: ${summary} | ${watchLog.map((w) => `${w.at}s ${w.saw}`).join(", ")}`;
  console.info("hands-free clip", JSON.stringify({ ...watchCounts, lookMs, answers, timeline: watchLog }));
  // The whole run, saved as a file: the checks, and the real answers the app gave.
  const record = {
    recorded: new Date().toISOString(),
    browser: navigator.userAgent,
    cloudModel: settings?.cloudModel,
    onDevice: shiftInfo?.onDevice,
    clip: clipFile,
    checks: watchLog,
    steps: clipSteps,
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }));
  a.download = "keep-until-handsfree-run.json";
  a.click();
}

async function watchLoop(run: number): Promise<void> {
  const live = () => handsFree && run === watchRun;
  const watchStarted = performance.now();
  const clipTime = () => Math.round(video.currentTime * 10) / 10;
  while (live()) {
    if (clipMode && video.ended) return finishClip();
    const triage = models?.triage;
    if (!triage || !video.videoWidth) {
      // Gemini Nano's first start has taken from seconds to over 15 minutes (2026-11-24). Until it
      // answers, Read item stays usable (items go to the cloud), and hands-free starts by itself.
      readBtn.disabled = reading;
      const waited = Math.round((performance.now() - watchStarted) / 60000);
      showWatching(
        laptopWarm
          ? "Waiting for the camera"
          : `This laptop's reader is starting${waited >= 1 ? ` (${waited} min so far)` : ""}. Press Read item meanwhile; hands-free starts by itself when it is ready.`,
      );
      await pause(1500);
      continue;
    }
    // A Read item pressed while the reader was warming may still be running: let it finish
    // first, so the two never read at once or overwrite each other's item.
    if (reading) {
      await pause(500);
      continue;
    }
    readBtn.disabled = true;
    // The clip starts once the laptop's reader is warm, like a volunteer starting on the first item.
    if (clipMode && video.paused && !video.ended) await video.play().catch(() => undefined);
    // Both sizes are taken together, so the frame the cloud reads is the frame the laptop checked.
    const small = toJpegBase64(video, video.videoWidth, video.videoHeight, 512);
    const frame = toJpegBase64(video, video.videoWidth, video.videoHeight);
    const sig = signature();
    let tr: TriageResult;
    try {
      tr = await triageItem(triage.model, small.b64);
      watchCounts.looks++;
      lookMs.push(tr.ms);
    } catch (e) {
      showWatching("This laptop could not check that frame. Trying again.");
      console.error(e);
      await pause(1000);
      continue;
    }
    if (!live()) return;
    // A check that took this long describes a table that has moved on: it is never acted on.
    // Measured 2026-11-26: on battery the laptop's GPU is throttled, Gemini Nano writes about
    // 4.5 tokens a second, and a check takes 8 to 9 s (it took about 2 s on 2026-11-22). Two late
    // checks in a row, and hands-free hands the job back to the Read item button and says why.
    const sees = { package: tr.triage.package_in_view, date: tr.triage.date_in_view, fridge: tr.triage.needs_refrigeration };
    if (tr.ms > STALE_CHECK_MS) {
      watchLog.push({ at: clipTime(), saw: "slow", ms: tr.ms, hidden: document.hidden, sees });
      const battery = await onBattery();
      if (++slowChecks >= 2 && !clipMode) {
        stopHandsFree();
        promptEl.textContent = battery
          ? "This laptop is on battery, which slows its reader too much for hands-free. Plug it in and press Hands-free again, or press Read item."
          : "This laptop is too busy to watch the camera right now, so hands-free is off. Press Read item.";
        say(fixedLine(battery ? "plug-in" : "hands-free-off"));
        return;
      }
      showWatching(battery ? "On battery this laptop's reader is slow, so that check came too late. Plug it in." : "This laptop is busy, so that check came too late. Checking again.");
      continue;
    }
    slowChecks = 0;
    const tally = `${watchCounts.looks} checks on this laptop, ${watchCounts.cloudReads} sent to the cloud`;
    const { next, state } = watchStep(tr.triage, watch, moved(sig, lastReadSig));
    watch = state;
    if (!watch.pending) pendingTurn = null; // the table cleared: the next item is a new item
    if (watch.clears >= 2) lastReadSig = null;
    watchLog.push({ at: clipTime(), saw: next, ms: tr.ms, hidden: document.hidden, sees });
    if (next === "clear") {
      showWatching(`Watching on this laptop. Hold up the next item. ${tally}`);
    } else if (next === "next") {
      showWatching(`Done. Put it down for the next item. ${tally}`);
    } else if (next === "again") {
      showWatching(`Hold it steady, date toward the camera. ${tally}`);
    } else if (next === "turn") {
      showWatching(`Turn it so the ${watch.pending === "name" ? "name" : "date"} faces the camera. Nothing sent. ${tally}`);
      if (!watch.pending) {
        // First sight of this item, with no date on this face: the laptop answers "turn it"
        // itself. The check is kept with the item, and nothing goes to the cloud.
        lastReadSig = sig;
        const step = await readCamera({ frame, small: small.b64, triaged: tr, patient: true });
        if (clipMode && step) clipSteps.push({ at: clipTime(), step });
        watch = afterRead(watch, step, true);
      }
    } else {
      showWatching(watch.pending === "name" ? "Reading the name in the cloud." : "Date in view. Reading it in the cloud.");
      watchCounts.cloudReads++;
      lastReadSig = sig;
      // After two looks that did not settle the item, the next one decides (it is set aside).
      const step = await readCamera({ frame, small: small.b64, triaged: tr, patient: watch.tries < 2 });
      if (clipMode && step) clipSteps.push({ at: clipTime(), step });
      if (step) {
        failures = 0;
        watch = afterRead(watch, step);
      } else if (live()) {
        // The read failed (the Wi-Fi dropped, the cloud was busy). The item is not done: the same
        // view is tried again, a little later each time.
        lastReadSig = null;
        failures++;
        showWatching("That read did not go through. Keep holding the item; trying again.");
        await pause(Math.min(30000, 2000 * 2 ** (failures - 1)));
      }
    }
  }
}

// Said aloud, for a volunteer looking at the item and not the screen. Hands-free turns it on
// (the click is the gesture browsers ask for before playing sound); the box turns it off, and
// that choice is remembered on this laptop. Every line is a recording shipped with the app
// (voice.ts), so nothing is sent anywhere to be spoken. If a recording cannot be played (first
// use with no connection), the browser's own voice says the same words.
const speakBox = $<HTMLInputElement>("speak");
speakBox.checked = localStorageGet("speak") === "on";
speakBox.addEventListener("change", () => {
  localStorageSet("speak", speakBox.checked ? "on" : "off");
  if (!speakBox.checked) hush();
});
const recordings = new Map<string, HTMLAudioElement>();
let speaking: HTMLAudioElement | null = null;
// Counts every answer said and every hush, so a late failure from an older answer is never
// mistaken for the current one (the same line twice shares one recording).
let sayTurn = 0;

function hush(): void {
  sayTurn++;
  speaking?.pause();
  speaking = null;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function say(line: Spoken | null): void {
  if (!line || !speakBox.checked) return;
  hush(); // the newest answer wins; an old one is never said late
  const turn = ++sayTurn;
  let audio = recordings.get(line.key);
  if (!audio) recordings.set(line.key, (audio = new Audio(`/voice/${line.key}.mp3`)));
  const mine = audio;
  speaking = mine;
  mine.currentTime = 0;
  mine.play().catch((e: unknown) => {
    // Paused by a newer answer (AbortError), or hushed: nothing more to say.
    if (turn !== sayTurn || (e instanceof DOMException && e.name === "AbortError")) return;
    // A recording that could not load is fetched again next time, once the connection is back.
    if (!(e instanceof DOMException && e.name === "NotAllowedError")) recordings.delete(line.key);
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(line.words);
    u.lang = "en-CA";
    speechSynthesis.speak(u);
  });
}

handsBtn.addEventListener("click", () => {
  if (handsFree) return stopHandsFree();
  handsFree = true;
  const run = ++watchRun;
  if (localStorageGet("speak") !== "off") speakBox.checked = true;
  handsBtn.setAttribute("aria-pressed", "true");
  handsBtn.textContent = "Hands-free on";
  readBtn.disabled = true;
  // A half-turned item from before is forgotten; an item just read by hand is not read again.
  pendingTurn = null;
  watch = { ...WATCH_START, ready: watch.ready };
  failures = 0;
  slowChecks = 0;
  if (clipMode && video.ended) video.currentTime = 0;
  // Said before the first late check, not after it.
  onBattery().then((b) => {
    if (b && handsFree) promptEl.textContent = "This laptop is on battery, which slows its reader. Plug it in for hands-free.";
  });
  watchLoop(run);
});

// ?clip=1 runs the whole thing with no hands: start the shift, then watch the clip hands-free.
// It starts only in a tab that is in view: a clip tab left open in the background would run this
// laptop's reader against the tab being watched, and slow both.
if (clipMode) {
  const begin = (): void => {
    if (document.hidden) return;
    document.removeEventListener("visibilitychange", begin);
    const play = (): Promise<void> => {
      $("start").click();
      let tries = 0;
      const go = setInterval(() => {
        if (++tries > 600) clearInterval(go); // no laptop reader here: the button says why
        else if (!handsBtn.disabled) {
          clearInterval(go);
          if (!handsFree) handsBtn.click(); // pressed by hand meanwhile: leave it on
        }
      }, 500);
      return new Promise<void>(() => undefined); // held until this tab closes or reloads
    };
    // One clip tab at a time. Two played it together on 2026-11-26, shared the laptop's reader,
    // and each check took twice as long. (Web Locks exist only on https and localhost.)
    if (!navigator.locks) return void play();
    void navigator.locks.request("keep-until-clip", { ifAvailable: true }, (lock) => {
      if (!lock) {
        document.title = "Keep Until: the clip is playing in another tab";
        promptEl.textContent = "The clip is already playing in another tab. Close that tab, then reload this one.";
        return;
      }
      return play();
    });
  };
  document.addEventListener("visibilitychange", begin);
  begin();
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  return img;
}

// The batch run is the measurement run. Its results go to the exported file only, never
// into a food bank's live item log.
batchBtn.addEventListener("click", () => {
  if (files.files?.length) void runBatch([...files.files]);
});

async function runBatch(list: File[]): Promise<void> {
  if (!models || !settings || !list.length) return;
  batchBtn.disabled = true;
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
}

// Dev server only (never in the built site): ?batch=<list.json>&mode=<mode>&today=<date> runs a
// measurement batch in this Chrome with no clicks, then downloads the results file. The list is a
// JSON array of photo URLs on the dev server. It is how Gemini Nano's own reads are measured, which
// needs a real Chrome: automated browsers have no real on-device model.
if (import.meta.env.DEV && new URLSearchParams(location.search).has("batch")) {
  (async () => {
    const q = new URLSearchParams(location.search);
    modeSel.value = q.get("mode") ?? modeSel.value;
    if (q.get("today")) todayInput.value = q.get("today")!;
    document.title = "Keep Until batch: starting";
    await prepare();
    const urls = (await (await fetch(q.get("batch")!)).json()) as string[];
    const list = await Promise.all(
      urls.map(async (u) => new File([await (await fetch(u)).blob()], u.split("/").pop()!, { type: "image/jpeg" })),
    );
    const t0 = performance.now();
    const tick = setInterval(() => (document.title = `Keep Until batch: ${toolStatus.textContent}`), 2000);
    await runBatch(list);
    clearInterval(tick);
    $("export").click();
    document.title = `Keep Until batch: done ${list.length} in ${Math.round((performance.now() - t0) / 1000)} s`;
  })().catch((e) => (document.title = `Keep Until batch: failed ${(e as Error).message}`));
}

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

// ?replay=1: plays back a recorded hands-free run on the same clip, in any browser, with no
// on-device model and no cloud call. The checks and the answers are the ones the app made on real
// Gemini Nano (web/public/testset/handsfree-run.json); nothing is read now, and the screen says so.
if (new URLSearchParams(location.search).has("replay")) {
  (async () => {
    const run = (await (await fetch("/testset/handsfree-run.json")).json()) as {
      recorded: string;
      checks: { at: number; saw: string }[];
      steps: { at: number; step: Step }[];
    };
    const day = new Date(run.recorded).toLocaleDateString("en-CA", { day: "numeric", month: "long", year: "numeric" });
    document.body.classList.add("started", "replay");
    readBtn.disabled = true;
    handsBtn.disabled = true;
    sheetBtn.hidden = true;
    setTimeout(() => (status.textContent = "Replay. Nothing is read in this browser."), 0);
    promptEl.textContent = `Replay of a real hands-free run on Gemini Nano in Chrome, ${day}. Nothing is read or sent now; the checks and answers are the ones the app made then.`;
    const words: Record<string, string> = {
      clear: "Watching on this laptop. Hold up the next item.",
      turn: "Turn it so the date faces the camera. Nothing sent yet.",
      next: "Done. Put it down for the next item.",
      read: "Date in view. Reading it in the cloud.",
    };
    let c = 0;
    let s = 0;
    let checks = 0;
    let sent = 0;
    video.srcObject = null;
    video.src = "/testset/handsfree-clip.webm";
    video.muted = true;
    video.addEventListener("timeupdate", () => {
      while (c < run.checks.length && run.checks[c].at <= video.currentTime) {
        const k = run.checks[c++];
        checks++;
        if (k.saw === "read") sent++;
        showWatching(`Replay. ${words[k.saw] ?? k.saw} ${checks} checks on the laptop, ${sent} sent to the cloud`);
      }
      while (s < run.steps.length && run.steps[s].at <= video.currentTime) {
        const { step } = run.steps[s++];
        results.push({ at: run.recorded, mode: InferenceMode.PREFER_ON_DEVICE, step });
        render(step, toJpegBase64(video, video.videoWidth, video.videoHeight, 320).url, "replay");
      }
    });
    video.addEventListener("ended", () => {
      // The run in one line, and the next thing to try.
      const items = run.steps.filter((x) => x.step.kind === "verdict").length;
      promptEl.textContent = `Replay finished: ${checks} checks on the laptop, ${sent} sent to the cloud, ${items} items answered. `;
      const next = document.createElement("a");
      next.href = "?sample=1";
      next.textContent = "Now read a sample photo yourself";
      promptEl.append(next, ". No sign-in needed.");
      showWatching(`Replay finished. ${checks} checks on the laptop, ${sent} sent to the cloud`);
    });
    await video.play().catch(() => (promptEl.textContent += " Press play: this browser blocked autoplay."));
  })();
}
