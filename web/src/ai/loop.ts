// One item through the loop. The model's next_action picks the branch; code adds only
// objective checks (the date it copied must parse, the category must exist) and the chart
// gate, which decides keep or discard. Self-reported confidence routes nothing.

import type { GenerativeModel } from "firebase/ai";
import { gate, type Policy, type Verdict } from "../chart/chart";
import { parseDateText, type ParsedDate } from "../chart/dates";
import { readItem, type Mode, type ReadResult } from "./reader";

export type Step =
  | { kind: "verdict"; reads: ReadResult[]; parsed: ParsedDate | null; verdict: Verdict; route: string }
  | { kind: "need_date_photo"; reads: ReadResult[]; route: string };

export interface LoopModels {
  hybrid: { model: GenerativeModel; mode: Mode };
  cloud: { model: GenerativeModel; mode: Mode };
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
  const first = await readItem(models.hybrid.model, models.hybrid.mode, jpegBase64, { barcodeProduct: ctx.barcodeProduct, secondLook });
  reads.push(first);

  const escalate = async (why: string): Promise<Step> => {
    if (first.source === "in_cloud") return setAside(reads, `${first.source}: ${why}; already in the cloud`, `the cloud model could not settle it: ${why}`);
    const second = await readItem(models.cloud.model, models.cloud.mode, jpegBase64, { barcodeProduct: ctx.barcodeProduct, secondLook });
    reads.push(second);
    const problem = second.read.next_action === "log" ? objectiveProblem(second, ctx.today) : second.read.why || second.read.next_action;
    if (problem) return setAside(reads, `on_device → cloud (${why}) → set aside`, `cloud read did not settle it: ${problem}`);
    return settle(reads, ctx.today, ctx.policy, `on_device chose ask_cloud (${why}) → cloud read`);
  };

  switch (first.read.next_action) {
    case "set_aside":
      return setAside(reads, `${first.source}: model chose set_aside`, first.read.why || "the model set it aside for the lead");
    case "show_me_the_date":
      if (secondLook) return escalate("still no date after turning the item");
      return { kind: "need_date_photo", reads, route: `${first.source}: model asked to see the date` };
    case "ask_cloud":
      return escalate(first.read.why || "model asked for the cloud");
    case "log": {
      const problem = objectiveProblem(first, ctx.today);
      if (problem) return escalate(problem);
      return settle(reads, ctx.today, ctx.policy, `${first.source}: model chose log`);
    }
  }
}
