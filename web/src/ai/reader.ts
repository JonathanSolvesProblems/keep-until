// The hybrid reader: one Firebase AI Logic model configured for both paths. With
// PREFER_ON_DEVICE the SDK runs Gemini Nano in Chrome when it is available and falls back
// to the cloud model when it is not; every result records which one answered.

import { getGenerativeModel, InferenceMode, ThinkingLevel, type GenerativeModel } from "firebase/ai";
import { trace } from "firebase/performance";
import { ai, perf } from "../firebase";
import { CATEGORY_IDS } from "../chart/chart";
import { CONFIDENCE, DAMAGE, DATE_KINDS, NEXT_ACTIONS, READ_SCHEMA, readPrompt, TRIAGE_PROMPT, TRIAGE_SCHEMA, type ItemRead, type Triage } from "./schema";

export type Mode = (typeof InferenceMode)[keyof typeof InferenceMode];

export interface ReadResult {
  read: ItemRead;
  source: "on_device" | "in_cloud";
  ms: number;
  mode: Mode;
  /** False when the model's answer was not the JSON the schema asks for. */
  valid: boolean;
}

export function makeModel(mode: Mode, cloudModel: string): GenerativeModel {
  return getGenerativeModel(ai, {
    mode,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: "image" }, { type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      },
      promptOptions: { responseConstraint: READ_SCHEMA },
    },
    inCloudParams: {
      model: cloudModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: READ_SCHEMA,
        temperature: 0,
        // Reading a label is perception, not reasoning. Minimal thinking took the cloud
        // read from minutes to about two seconds (devpost/build-log.md, 2026-11-15).
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL as never },
        // A read is about 150 tokens. A read stuck repeating digits once ran for 100 seconds on
        // the Galaxy S24 before its JSON broke (2026-11-27); capped, it fails in seconds.
        maxOutputTokens: READ_MAX_TOKENS,
      },
    },
  }, { timeout: READ_TIMEOUT_MS });
}

/** Shared with the Android reader (PhoneReaders.kt). */
export const READ_MAX_TOKENS = 1024;
export const READ_TIMEOUT_MS = 30_000;

/** The on-device triage model: Gemini Nano only, small schema, nothing leaves the laptop. */
export function makeTriageModel(): GenerativeModel {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: "image" }, { type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      },
      promptOptions: { responseConstraint: TRIAGE_SCHEMA },
    },
    inCloudParams: { model: "unused-on-device-only" },
  });
}

export interface TriageResult {
  triage: Triage;
  ms: number;
}

/** Triage one photo on-device. Throws on any failure or malformed answer, so the caller falls back to the cloud read. */
export async function triageItem(model: GenerativeModel, jpegBase64: string): Promise<TriageResult> {
  if (!browserHasOnDeviceModel()) throw new Error("no on-device model in this browser");
  const t = trace(perf, "item_triage");
  t.start();
  const t0 = performance.now();
  try {
    const result = await model.generateContent([
      { type: "inlineData", inlineData: { mimeType: "image/jpeg", data: jpegBase64 } },
      { type: "text", text: TRIAGE_PROMPT },
    ]);
    if (result.response.inferenceSource !== "on_device") throw new Error("triage did not run on-device");
    const raw = JSON.parse(result.response.text()) as Partial<Triage>;
    if (typeof raw.package_in_view !== "boolean" || typeof raw.date_in_view !== "boolean" || typeof raw.needs_refrigeration !== "boolean") {
      throw new Error("triage answer is missing its yes/no fields");
    }
    const ms = Math.round(performance.now() - t0);
    t.putAttribute("source", "on_device");
    t.putMetric("ms", ms);
    return { triage: { package_in_view: raw.package_in_view, date_in_view: raw.date_in_view, needs_refrigeration: raw.needs_refrigeration, product: String(raw.product ?? "") }, ms };
  } catch (e) {
    t.putAttribute("source", "error");
    throw e;
  } finally {
    t.stop();
  }
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function isJson(text: string): boolean {
  try {
    return typeof JSON.parse(text) === "object";
  } catch {
    return false;
  }
}

/** Validates the model's JSON. Anything malformed becomes a set-aside, never a guess. */
export function toItemRead(text: string): ItemRead {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      product: "", brand: "", category: "", date_text: "", date_kind: "none_visible", damage: "unsure",
      confidence: "low", next_action: "set_aside", why: "the model's answer was not valid JSON",
    };
  }
  return {
    product: String(raw.product ?? ""),
    brand: String(raw.brand ?? ""),
    category: oneOf(raw.category, [...CATEGORY_IDS, "unclear"], "unclear"),
    date_text: String(raw.date_text ?? ""),
    date_kind: oneOf(raw.date_kind, DATE_KINDS, "none_visible"),
    damage: oneOf(raw.damage, DAMAGE, "unsure"),
    confidence: oneOf(raw.confidence, CONFIDENCE, "low"),
    next_action: oneOf(raw.next_action, NEXT_ACTIONS, "set_aside"),
    why: String(raw.why ?? ""),
  };
}

/**
 * The Gemini Developer API free tier allows 15 requests a minute for this model, and a 429
 * says how long to wait ("Please retry in 26.8s"). One sort table can hit that, so a cloud
 * read waits it out (up to a minute, twice) instead of failing the item.
 */
export function retryDelayMs(err: unknown): number | undefined {
  const msg = String((err as Error)?.message ?? err);
  if (!msg.includes("429")) return undefined;
  const m = msg.match(/retry in ([\d.]+)s/i);
  const s = m ? Number(m[1]) : 20;
  return Math.min(60_000, Math.ceil(s * 1000) + 250);
}

export let onRateLimitWait: ((ms: number) => void) | null = null;
export function setRateLimitListener(fn: ((ms: number) => void) | null): void {
  onRateLimitWait = fn;
}

export async function readItem(
  model: GenerativeModel,
  mode: Mode,
  jpegBase64: string,
  context: Parameters<typeof readPrompt>[0] = {},
): Promise<ReadResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await readOnce(model, mode, jpegBase64, context);
    } catch (e) {
      const wait = retryDelayMs(e);
      if (wait === undefined || attempt >= 2) throw e;
      onRateLimitWait?.(wait);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/** True when this browser has Chrome's built-in on-device model API at all. */
export function browserHasOnDeviceModel(): boolean {
  return typeof (globalThis as { LanguageModel?: unknown }).LanguageModel !== "undefined";
}

async function readOnce(
  model: GenerativeModel,
  mode: Mode,
  jpegBase64: string,
  context: Parameters<typeof readPrompt>[0],
): Promise<ReadResult> {
  // The SDK only builds its on-device adapter when the browser has LanguageModel; without it,
  // every call goes to the cloud whatever the mode, including ONLY_ON_DEVICE. "On-device
  // only" is a promise that the photo stays on this machine, so it is kept here, before any
  // request is made.
  if (mode === InferenceMode.ONLY_ON_DEVICE && !browserHasOnDeviceModel()) {
    throw new Error("on-device only, but this browser has no on-device model; the photo was not sent anywhere");
  }
  // A Performance Monitoring trace per read, tagged with where it ran, so real-world
  // on-device and cloud latency show up side by side in the Firebase console.
  const t = trace(perf, "item_read");
  t.start();
  t.putAttribute("mode", mode);
  const t0 = performance.now();
  try {
    const result = await model.generateContent([
      { type: "inlineData", inlineData: { mimeType: "image/jpeg", data: jpegBase64 } },
      { type: "text", text: readPrompt(context) },
    ]);
    const ms = Math.round(performance.now() - t0);
    const source = result.response.inferenceSource === "on_device" ? "on_device" : "in_cloud";
    if (mode === InferenceMode.ONLY_ON_DEVICE && source !== "on_device") {
      throw new Error("on-device only, but the read came back from the cloud; result discarded");
    }
    const text = result.response.text();
    const read = toItemRead(text);
    const valid = isJson(text);
    t.putAttribute("source", source);
    t.putAttribute("next_action", read.next_action);
    t.putMetric("ms", ms);
    return { read, source, ms, mode, valid };
  } catch (e) {
    t.putAttribute("source", "error");
    throw e;
  } finally {
    t.stop();
  }
}
