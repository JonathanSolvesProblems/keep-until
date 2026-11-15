// One item through the loop. The model's next_action picks the branch; code adds only
// objective checks (the date it copied must parse, the category must exist) and the chart
// gate, which decides keep or discard. Self-reported confidence routes nothing.

import type { GenerativeModel } from "firebase/ai";
import { gate, type Policy, type Verdict } from "../chart/chart";
import { parseDateText, type ParsedDate } from "../chart/dates";
import { readItem, type Mode, type ReadResult } from "./reader";

export type Step =
  | { kind: "verdict"; reads: ReadResult[]; parsed: ParsedDate | null; verdict: Verdict; route: string }
  | { kind: "need_date_photo"; reads: ReadResult[]; route: string }
  | { kind: "no_item"; reads: ReadResult[]; route: string };

export interface LoopModels {
  hybrid: { model: GenerativeModel; mode: Mode };
  /** The model a hard read is handed to. Null in the on-device-only ablation: nothing leaves the laptop. */
  cloud: { model: GenerativeModel; mode: Mode } | null;
}

export interface ItemContext {
  today: string;
  policy?: Policy;
  barcodeProduct?: string;
  /** Reads already made for this item (the first photo, before the volunteer turned it). */
  previous?: ReadResult[];
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

  // The SDK falls back to the cloud only when the on-device model is unavailable, not when an
  // on-device call fails (a context-window overflow, a crash) or returns something that is not
  // the schema's JSON. A hybrid read must never fail for that, so it hands the photo up here.
  let first: ReadResult;
  let fallback = "";
  try {
    first = await readItem(models.hybrid.model, models.hybrid.mode, jpegBase64, readContext);
  } catch (e) {
    if (!models.cloud) throw e;
    fallback = `on-device failed (${(e as Error).message}) → `;
    first = await readItem(models.cloud.model, models.cloud.mode, jpegBase64, readContext);
  }
  if (!first.valid && first.source === "on_device" && models.cloud) {
    reads.push(first);
    fallback = "on-device answer was not valid JSON → ";
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
    return settle(reads, ctx.today, ctx.policy, routed(`on_device chose ask_cloud (${why}) → cloud read`));
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
      return settle(reads, ctx.today, ctx.policy, routed(`${first.source}: model chose log`));
    }
  }
}
