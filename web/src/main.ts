import { InferenceMode } from "firebase/ai";
import { makeModel, type Mode } from "./ai/reader";
import { processItem, type LoopModels, type Step } from "./ai/loop";

// Defaults until Remote Config is wired: the cloud fallback reads worn stamps, a vision task.
const CLOUD_MODEL = "gemini-3.8-flash";

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
let pendingTurn: Step | null = null;

function buildModels(mode: Mode): LoopModels {
  return {
    hybrid: { model: makeModel(mode, CLOUD_MODEL), mode },
    cloud: { model: makeModel(InferenceMode.ONLY_IN_CLOUD, CLOUD_MODEL), mode: InferenceMode.ONLY_IN_CLOUD },
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
  models = buildModels(mode);
  if (mode !== InferenceMode.ONLY_IN_CLOUD) {
    status.textContent = "preparing on-device model";
    try {
      await models.hybrid.model.initializeDeviceModel((p) => (status.textContent = `downloading on-device model ${Math.round(p * 100)}%`));
    } catch (e) {
      status.textContent = "on-device unavailable: " + (e as Error).message;
    }
  }
  status.textContent = (await describeOnDevice()) + ` · mode ${mode}`;
  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
  } catch {
    promptEl.textContent = "no camera; use saved photos";
  }
  readBtn.disabled = false;
  batchBtn.disabled = false;
});

modeSel.addEventListener("change", () => {
  if (models) models = buildModels(modeSel.value as Mode);
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
  if (!models || !video.videoWidth) return;
  readBtn.disabled = true;
  const frame = toJpegBase64(video, video.videoWidth, video.videoHeight);
  try {
    const step = await processItem(models, frame.b64, {
      today: todayInput.value,
      previous: pendingTurn ? pendingTurn.reads : undefined,
    });
    pendingTurn = step.kind === "need_date_photo" ? step : null;
    promptEl.textContent = pendingTurn ? "Turn the item so the date faces the camera, then Read item again." : "";
    results.push({ at: new Date().toISOString(), mode: models.hybrid.mode, step });
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

batchBtn.addEventListener("click", async () => {
  if (!models || !files.files?.length) return;
  batchBtn.disabled = true;
  const list = [...files.files];
  for (const [i, file] of list.entries()) {
    status.textContent = `batch ${i + 1}/${list.length} · ${file.name}`;
    const img = await loadImage(file);
    const frame = toJpegBase64(img, img.naturalWidth, img.naturalHeight);
    try {
      const step = await processItem(models, frame.b64, { today: todayInput.value });
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
  const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), cloudModel: CLOUD_MODEL, results }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `keep-until-results-${Date.now()}.json`;
  a.click();
});
