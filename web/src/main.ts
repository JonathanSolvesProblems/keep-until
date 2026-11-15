import { InferenceMode } from "firebase/ai";
import { makeModel, type Mode } from "./ai/reader";
import { processItem, type LoopModels, type Step } from "./ai/loop";
import { ensureSignedIn, loadSettings, type Settings } from "./firebase";
import { logItem, startShift } from "./store";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = $("status");
const modeSel = $<HTMLSelectElement>("mode");
const todayInput = $<HTMLInputElement>("today");
const video = $<HTMLVideoElement>("video");
const readBtn = $<HTMLButtonElement>("read");
const batchBtn = $<HTMLButtonElement>("batch");
const files = $<HTMLInputElement>("files");
const promptEl = $("prompt");
const log = $("log");

todayInput.value = new Date().toISOString().slice(0, 10);

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
let pendingTurn: Step | null = null;

function buildModels(mode: Mode, cloudModel: string): LoopModels {
  return {
    hybrid: { model: makeModel(mode, cloudModel), mode },
    cloud: { model: makeModel(InferenceMode.ONLY_IN_CLOUD, cloudModel), mode: InferenceMode.ONLY_IN_CLOUD },
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

describeOnDevice().then((s) => (status.textContent = s));

$("start").addEventListener("click", async () => {
  const mode = modeSel.value as Mode;
  status.textContent = "signing in";
  const uid = await ensureSignedIn();
  settings = await loadSettings();
  models = buildModels(mode, settings.cloudModel);
  if (mode !== InferenceMode.ONLY_IN_CLOUD) {
    status.textContent = "preparing on-device model";
    try {
      await models.hybrid.model.initializeDeviceModel((p) => (status.textContent = `downloading on-device model ${Math.round(p * 100)}%`));
    } catch (e) {
      status.textContent = "on-device unavailable: " + (e as Error).message;
    }
  }
  const onDevice = await describeOnDevice();
  shift = { id: startShift({ foodBankId: settings.foodBankId, uid, mode, onDevice, cloudModel: settings.cloudModel }), uid };
  status.textContent = `${settings.foodBankName} · ${onDevice} · mode ${mode} · cloud ${settings.cloudModel} (${settings.from} config)`;
  await openCamera(localStorageGet("camera"));
  await listCameras();
  readBtn.disabled = false;
  batchBtn.disabled = false;
});

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
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    promptEl.textContent = "";
    // A phone used as a webcam (Windows Phone Link) sends no picture while the phone is locked.
    setTimeout(() => {
      if (video.srcObject && !video.videoWidth) {
        promptEl.textContent = "This camera sends no picture. If it is a phone, unlock it, or pick another camera.";
      }
    }, 3000);
  } catch {
    promptEl.textContent = "no camera; use saved photos";
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

function render(step: Step, thumb: string, label: string): void {
  const last = step.reads[step.reads.length - 1];
  const div = document.createElement("div");
  div.className = "item";
  const decision = step.kind === "verdict" ? step.verdict.decision : "TURN IT";
  const until = step.kind === "verdict" && step.verdict.keepUntil ? ` until ${step.verdict.keepUntil}` : "";
  const reason = step.kind === "verdict" ? step.verdict.reason : last.read.why;
  const page = step.kind === "verdict" && step.verdict.chart ? ` · chart p.${step.verdict.chart.page}` : "";
  div.innerHTML = `<img alt="" /><div>
    <div><span class="decision"></span><span class="badge"></span></div>
    <div class="product"></div>
    <div class="small reason"></div>
    <div class="small route"></div></div>`;
  (div.querySelector("img") as HTMLImageElement).src = thumb;
  const d = div.querySelector(".decision")!;
  d.textContent = decision + until;
  d.classList.add(step.kind === "verdict" ? step.verdict.decision : "SET_ASIDE");
  div.querySelector(".badge")!.textContent = step.reads.map((r) => `${r.source === "on_device" ? "ON-DEVICE" : "CLOUD"} ${r.ms} ms`).join(" → ");
  div.querySelector(".product")!.textContent = `${last.read.brand} ${last.read.product} · ${last.read.category} · "${last.read.date_text}" (${last.read.date_kind})`;
  div.querySelector(".reason")!.textContent = reason + page;
  div.querySelector(".route")!.textContent = `${label} · ${step.route}`;
  log.prepend(div);
}

readBtn.addEventListener("click", async () => {
  if (!models || !settings || !shift || !video.videoWidth) return;
  readBtn.disabled = true;
  const frame = toJpegBase64(video, video.videoWidth, video.videoHeight);
  try {
    const step = await processItem(models, frame.b64, {
      today: todayInput.value,
      policy: settings.policy,
      previous: pendingTurn ? pendingTurn.reads : undefined,
    });
    pendingTurn = step.kind === "need_date_photo" ? step : null;
    promptEl.textContent = pendingTurn ? "Turn the item so the date faces the camera, then Read item again." : "";
    results.push({ at: new Date().toISOString(), mode: models.hybrid.mode, step });
    if (step.kind === "verdict") logItem(settings.foodBankId, shift.id, shift.uid, step, settings.policy);
    render(step, frame.url, "camera");
  } catch (e) {
    promptEl.textContent = "error: " + (e as Error).message;
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

// The batch run is the measurement harness. Its results go to the exported file only, never
// into a food bank's live item log.
batchBtn.addEventListener("click", async () => {
  if (!models || !settings || !files.files?.length) return;
  batchBtn.disabled = true;
  const list = [...files.files];
  for (const [i, file] of list.entries()) {
    status.textContent = `batch ${i + 1}/${list.length} · ${file.name}`;
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
  status.textContent = `batch done: ${list.length} photos · mode ${models.hybrid.mode}`;
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
