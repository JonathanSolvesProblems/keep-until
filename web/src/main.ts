import "./styles.css";
import { InferenceMode } from "firebase/ai";
import { browserHasOnDeviceModel, makeModel, makeTriageModel, setRateLimitListener, type Mode } from "./ai/reader";
import { processItem, type LoopModels, type Step } from "./ai/loop";
import { ensureSignedIn, loadSettings, type Settings } from "./firebase";
import { logItem, startShift } from "./store";
import { appendRow, connectSheet, pendingRows, sheetUrl } from "./sheet";
import { renderAnswer, renderRow, renderTally } from "./view";

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
  promptEl.textContent = `Cloud limit reached (the free tier allows 15 reads a minute). Waiting ${Math.round(ms / 1000)} s, then retrying.`;
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

$("start").addEventListener("click", async () => {
  const mode = modeSel.value as Mode;
  status.textContent = "Starting the shift";
  const uid = await ensureSignedIn();
  settings = await loadSettings();
  models = buildModels(mode, settings.cloudModel);
  if (mode !== InferenceMode.ONLY_IN_CLOUD) {
    status.textContent = "Getting this laptop's reader ready";
    try {
      await models.hybrid.model.initializeDeviceModel((p) => (status.textContent = `Downloading this laptop's reader, ${Math.round(p * 100)}%`));
    } catch (e) {
      status.textContent = "This laptop cannot read on its own right now, so items go to the cloud.";
    }
  }
  const onDevice = await describeOnDevice();
  // The shift record is written with the first logged item, so a measurement batch that
  // never logs anything leaves no empty shift in the food bank's data.
  shiftInfo = { foodBankId: settings.foodBankId, uid, mode, onDevice, cloudModel: settings.cloudModel };
  shift = null;
  const sortDay = new Date(todayInput.value + "T12:00:00").toLocaleDateString("en-CA", { weekday: "long", day: "numeric", month: "long" });
  status.textContent = `${settings.foodBankName}, sorting ${sortDay}. Reading ${MODE_WORDS[mode] ?? mode}.`;
  document.body.classList.add("started");
  await openCamera(localStorageGet("camera"));
  await listCameras();
  readBtn.disabled = false;
  batchBtn.disabled = false;
  compareBtn.disabled = false;
  sheetBtn.disabled = false;
  showSheetStatus();
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
    sheetBtn.textContent = "Reconnect the sheet";
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

async function openCamera(deviceId?: string): Promise<void> {
  (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
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
  if (models && settings) models = buildModels(modeSel.value as Mode, settings.cloudModel);
});

function toJpegBase64(source: CanvasImageSource, w: number, h: number): { b64: string; url: string } {
  const scale = Math.min(1, 1024 / Math.max(w, h));
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

readBtn.addEventListener("click", async () => {
  if (!models || !settings || !shiftInfo || !video.videoWidth) return;
  readBtn.disabled = true;
  const frame = toJpegBase64(video, video.videoWidth, video.videoHeight);
  try {
    const step = await processItem(models, frame.b64, {
      today: todayInput.value,
      policy: settings.policy,
      previous: pendingTurn ? pendingTurn.reads : undefined,
    });
    pendingTurn = step.kind === "need_date_photo" ? step : null;
    promptEl.textContent = "";
    results.push({ at: new Date().toISOString(), mode: models.hybrid.mode, step });
    if (step.kind === "verdict") {
      shift ??= { id: startShift(shiftInfo), uid: shiftInfo.uid };
      const logged = logItem(settings.foodBankId, shift.id, shift.uid, step, settings.policy);
      // The item also lands in the food bank's own sheet; if it cannot yet, it waits.
      if (sheetUrl()) appendRow(logged.sheetRow).then((waiting) => showSheetStatus(waiting ? "" : "row added"));
    }
    render(step, frame.url, "camera");
  } catch (e) {
    promptEl.textContent = "That read did not go through. Hold the item steady and press Read item again.";
    console.error(e);
  } finally {
    readBtn.disabled = false;
  }
});

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
  for (const [i, file] of list.entries()) {
    toolStatus.textContent = `Reading photo ${i + 1} of ${list.length}`;
    const img = await loadImage(file);
    const frame = toJpegBase64(img, img.naturalWidth, img.naturalHeight);
    try {
      const step = await processItem(models, frame.b64, { today: todayInput.value, policy: settings.policy });
      results.push({ file: file.name, at: new Date().toISOString(), mode: models.hybrid.mode, step });
      render(step, frame.url, file.name);
    } catch (e) {
      results.push({ file: file.name, at: new Date().toISOString(), mode: models.hybrid.mode, step: { kind: "need_date_photo", reads: [], route: "error: " + (e as Error).message } });
    }
  }
  toolStatus.textContent = `Done: ${list.length} ${list.length === 1 ? "photo" : "photos"} read ${MODE_WORDS[models.hybrid.mode] ?? ""}`;
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
