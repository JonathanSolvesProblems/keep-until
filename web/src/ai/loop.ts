// One item through the loop. The model's next_action picks the branch; code adds only
// objective checks (the date it copied must parse, the category must exist) and the chart
// gate, which decides keep or discard. Self-reported confidence routes nothing.

import type { GenerativeModel } from "firebase/ai";
import { gate, type Policy, type Verdict } from "../chart/chart";
import { parseDateText, type ParsedDate } from "../chart/dates";
import { readItem, triageItem, type Mode, type ReadResult, type TriageResult } from "./reader";

export type Step =
  | { kind: "verdict"; reads: ReadResult[]; parsed: ParsedDate | null; verdict: Verdict; route: string }
  | { kind: "need_date_photo"; reads: ReadResult[]; route: string }
  | { kind: "no_item"; reads: ReadResult[]; route: string };

export interface LoopModels {
  hybrid: { model: GenerativeModel; mode: Mode };
  /** The model a hard read is handed to. Null in the on-device-only ablation: nothing leaves the laptop. */
  cloud: { model: GenerativeModel; mode: Mode } | null;
  /**
   * On-device triage (Gemini Nano). When present, the laptop answers "no item" and "turn it"
   * itself, and only photos with a date in view, or that may need the fridge, go to the cloud.
   */
  triage?: { model: GenerativeModel } | null;
}

export interface ItemContext {
  today: string;
  policy?: Policy;
  barcodeProduct?: string;
  /** Reads already made for this item (the first photo, before the volunteer turned it). */
  previous?: ReadResult[];
  /**
   * The same photo at a smaller size. Gemini Nano refused a 1024 px webcam frame with "The
   * input is too large" on 2026-11-16, and the read went to the cloud unnoticed; triage then
   * retries with this copy before giving up on the laptop.
   */
  smallJpeg?: string;
}

function settle(reads: ReadResult[], today: string, policy: Policy | undefined, route: string): Step {
  const last = reads[reads.length - 1].read;
  const parsed = last.date_text ? parseDateText(last.date_text, today) : null;
  const verdict = gate({
    categoryId: last.category,
    date: parsed,
    dateKind: last.date_kind,
    damage: last.damage,
    today,
    policy,
  });
  return { kind: "verdict", reads, parsed, verdict, route };
}

/** Keeps the on-device triage decision in the item's record, next to the reads it led to. */
function triageAsRead(tr: TriageResult): ReadResult {
  const t = tr.triage;
  const next = !t.package_in_view ? "no_item" : !t.date_in_view && !t.needs_refrigeration ? "show_me_the_date" : "ask_cloud";
  return {
    read: {
      product: t.product,
      brand: "",
      category: "unclear",
      date_text: "",
      date_kind: "none_visible",
      damage: "none",
      confidence: "low",
      next_action: next,
      why: `triage: package ${t.package_in_view ? "yes" : "no"}, date in view ${t.date_in_view ? "yes" : "no"}, fridge ${t.needs_refrigeration ? "yes" : "no"}`,
    },
    source: "on_device",
    ms: tr.ms,
    mode: "only_on_device",
    valid: true,
  };
}

function dateKey(p: ParsedDate | null): string {
  if (!p) return "no date";
  if (p.kind === "exact") return p.iso;
  if (p.kind === "ambiguous") return p.candidates.join(" or ");
  return "unreadable";
}

/**
 * Binning edible food is the failure this app exists to prevent, and one read can misread a
 * stamp (the same photo has come back as "2027 MA 17" and as "26MA14"). So a DISCARD is never
 * decided on one read: a second read must find the same date, or the item goes to a person.
 */
async function confirmDiscard(step: Step, models: LoopModels, jpegBase64: string, readContext: Parameters<typeof readItem>[3], today: string): Promise<Step> {
  if (step.kind !== "verdict" || step.verdict.decision !== "DISCARD") return step;
  const checker = models.cloud ?? models.hybrid;
  let check: ReadResult;
  try {
    check = await readItem(checker.model, checker.mode, jpegBase64, readContext);
  } catch (e) {
    return {
      ...step,
      verdict: { ...step.verdict, decision: "SET_ASIDE", reason: `would discard, but the confirming read failed (${(e as Error).message}); a person checks it` },
      route: step.route + " → confirming read failed → set aside",
    };
  }
  const reads = [...step.reads, check];
  const second = check.read.date_text ? parseDateText(check.read.date_text, today) : null;
  if (dateKey(second) === dateKey(step.parsed) && step.parsed?.kind === "exact") {
    return { ...step, reads, route: step.route + ` → discard confirmed by a second read (${check.source})` };
  }
  return {
    kind: "verdict",
    reads,
    parsed: step.parsed,
    verdict: {
      decision: "SET_ASIDE",
      pastPrintedDate: false,
      chart: step.verdict.chart,
      reason: `two reads disagree on the date (${dateKey(step.parsed)} vs ${dateKey(second)}), so a person checks it before anything is binned`,
    },
    route: step.route + ` → second read (${check.source}) disagreed → set aside`,
  };
}

function setAside(reads: ReadResult[], route: string, reason: string): Step {
  return { kind: "verdict", reads, parsed: null, verdict: { decision: "SET_ASIDE", pastPrintedDate: false, reason }, route };
}

/** Why a "log" answer cannot be trusted as-is, tested against facts rather than the model's own confidence. */
function objectiveProblem(r: ReadResult, today: string): string | undefined {
  if (r.read.category === "unclear") return "no chart category";
  if (r.read.date_kind !== "none_visible") {
    if (!r.read.date_text) return "date kind given but no date characters";
    const p = parseDateText(r.read.date_text, today);
    if (p.kind === "unreadable") return `date "${r.read.date_text}" does not parse (${p.why})`;
  }
  return undefined;
}

export async function processItem(models: LoopModels, jpegBase64: string, ctx: ItemContext): Promise<Step> {
  const reads = [...(ctx.previous ?? [])];
  const secondLook = reads.length > 0;
  const readContext = { barcodeProduct: ctx.barcodeProduct, secondLook };

  // Triage first, on the laptop, when this browser can do it. Measured on real Gemini Nano,
  // triage is the job it does well (10 of 15) and the full read is not (4 of 15), so with
  // triage the full read goes to the cloud, and only for photos worth reading.
  const useTriage = Boolean(models.triage && models.cloud);
  let fallback = "";
  if (useTriage && !secondLook) {
    try {
      let tr;
      try {
        tr = await triageItem(models.triage!.model, jpegBase64);
      } catch (e) {
        if (!ctx.smallJpeg || !/too large/i.test((e as Error).message)) throw e;
        fallback = "on_device triage: photo too large, retried smaller → ";
        tr = await triageItem(models.triage!.model, ctx.smallJpeg);
      }
      const tread = triageAsRead(tr);
      if (!tr.triage.package_in_view) {
        return { kind: "no_item", reads: [...reads, tread], route: "on_device triage: no package in view; no cloud call" };
      }
      if (!tr.triage.date_in_view && !tr.triage.needs_refrigeration) {
        return { kind: "need_date_photo", reads: [...reads, tread], route: "on_device triage: no date in view; no cloud call" };
      }
      reads.push(tread);
      fallback += `on_device triage: ${tr.triage.date_in_view ? "date in view" : "may need the fridge"} → `;
    } catch (e) {
      fallback = `on-device triage failed (${(e as Error).message}) → `;
    }
  }
  const primary = useTriage ? models.cloud! : models.hybrid;

  // The SDK falls back to the cloud only when the on-device model is unavailable, not when an
  // on-device call fails (a context-window overflow, a crash) or returns something that is not
  // the schema's JSON. A hybrid read must never fail for that, so it hands the photo up here.
  let first: ReadResult;
  try {
    first = await readItem(primary.model, primary.mode, jpegBase64, readContext);
  } catch (e) {
    if (!models.cloud) throw e;
    fallback += `on-device failed (${(e as Error).message}) → `;
    first = await readItem(models.cloud.model, models.cloud.mode, jpegBase64, readContext);
  }
  if (!first.valid && first.source === "on_device" && models.cloud) {
    reads.push(first);
    fallback += "on-device answer was not valid JSON → ";
    first = await readItem(models.cloud.model, models.cloud.mode, jpegBase64, readContext);
  }
  reads.push(first);
  const routed = (route: string) => fallback + route;

  const escalate = async (why: string): Promise<Step> => {
    if (first.source === "in_cloud") return setAside(reads, routed(`${first.source}: ${why}; already in the cloud`), `the cloud model could not settle it: ${why}`);
    if (!models.cloud) return setAside(reads, routed(`${first.source}: ${why}; cloud switched off`), `on-device could not settle it and the cloud is off: ${why}`);
    const second = await readItem(models.cloud.model, models.cloud.mode, jpegBase64, readContext);
    reads.push(second);
    const problem = second.read.next_action === "log" ? objectiveProblem(second, ctx.today) : second.read.why || second.read.next_action;
    if (problem) return setAside(reads, routed(`on_device → cloud (${why}) → set aside`), `cloud read did not settle it: ${problem}`);
    return confirmDiscard(settle(reads, ctx.today, ctx.policy, routed(`on_device chose ask_cloud (${why}) → cloud read`)), models, jpegBase64, readContext, ctx.today);
  };

  switch (first.read.next_action) {
    case "no_item":
      // Nothing to log, and the next item is a new item, not the back of this one.
      return { kind: "no_item", reads, route: routed(`${first.source}: model saw no item`) };
    case "set_aside":
      return setAside(reads, routed(`${first.source}: model chose set_aside`), first.read.why || "the model set it aside for the lead");
    case "show_me_the_date":
      if (secondLook) return escalate("still no date after turning the item");
      return { kind: "need_date_photo", reads, route: routed(`${first.source}: model asked to see the date`) };
    case "ask_cloud":
      return escalate(first.read.why || "model asked for the cloud");
    case "log": {
      const problem = objectiveProblem(first, ctx.today);
      if (problem) return escalate(problem);
      return confirmDiscard(settle(reads, ctx.today, ctx.policy, routed(`${first.source}: model chose log`)), models, jpegBase64, readContext, ctx.today);
    }
  }
}
