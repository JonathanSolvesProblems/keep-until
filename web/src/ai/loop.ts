// One item through the loop. The model's next_action picks the branch; code adds only
// objective checks (the date it copied must parse, the category must exist) and the chart
// gate, which decides keep or discard. Self-reported confidence routes nothing.

import type { GenerativeModel } from "firebase/ai";
import { gate, type Policy, type Verdict } from "../chart/chart";
import { parseDateText, type ParsedDate } from "../chart/dates";
import { readItem, triageItem, type Mode, type ReadResult, type TriageResult } from "./reader";
import type { ItemRead } from "./schema";

export type Step =
  | { kind: "verdict"; reads: ReadResult[]; parsed: ParsedDate | null; verdict: Verdict; route: string }
  // "Turn it": the date is not in view, or (want: "name") the date is read and the name is not.
  | { kind: "need_date_photo"; reads: ReadResult[]; route: string; want?: "name" }
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
  /** How long the laptop check may take before this item goes to the cloud without it. */
  triageBudgetMs?: number;
  /** The laptop already checked this frame (hands-free watching), so it is not checked twice. */
  triaged?: TriageResult;
  /**
   * Hands-free: this look was started by the laptop, not by a person pressing Read item. A second
   * look that does not settle the item then leaves it waiting for the right face, where a
   * deliberate second press would set it aside.
   */
  watching?: boolean;
  /** What the item was last asked to show, kept when a watching look adds nothing. */
  want?: "name";
}

/**
 * Hands-free: Gemini Nano on the laptop watches the camera, and the cloud is called only when a
 * package with its date facing the camera (or a fridge item) is in front of it. Watching every
 * frame is only affordable on the device: in the cloud it would be a paid call, and a video of
 * the sort table leaving the building, every few seconds.
 *
 * The rules below decide, from each check, whether anything is sent. They exist because a person
 * holds an item up for many checks in a row: one can must be read once, an item asked to be
 * turned must be read again only when another face is shown, and one wrong "nothing here" from
 * the laptop must not start the item over.
 */
export interface WatchState {
  /** The table has been clear since the last item was settled, so the next item may be read. */
  ready: boolean;
  /** This item was asked to be turned, and for which face. */
  pending: "date" | "name" | null;
  /** Checks in a row with no package in view. Two clear the table; one may be the laptop's mistake. */
  clears: number;
  /** Since this item's last read: how many checks, and whether one saw a face with no date. */
  sinceRead: number;
  sawOtherFace: boolean;
  /** Reads of this item that did not settle it. After two, the next one decides (set aside). */
  tries: number;
}
export const WATCH_START: WatchState = { ready: true, pending: null, clears: 0, sinceRead: 0, sawOtherFace: false, tries: 0 };

/** clear: no item. turn: show another face, nothing sent. read: send this frame. next: this item is answered. again: hold it steady. */
export type Watch = "clear" | "turn" | "read" | "next" | "again";

/** `changed`: this view differs from the frame last read. */
export function watchStep(t: TriageResult["triage"], s: WatchState, changed: boolean): { next: Watch; state: WatchState } {
  if (!t.package_in_view) {
    const clears = s.clears + 1;
    // An item that left the table takes its half-finished turn with it: the next item starts fresh.
    if (clears >= 2) return { next: "clear", state: { ...WATCH_START, clears } };
    return { next: "clear", state: { ...s, clears, sawOtherFace: true } };
  }
  const dateFace = t.date_in_view || t.needs_refrigeration;
  if (s.pending) {
    // The face just read is not read again while the person is still turning the item: the
    // laptop must have seen another face since, or two checks must have passed.
    const waited = s.sawOtherFace || s.sinceRead >= 2;
    const wanted = s.pending === "name" ? waited || !dateFace : dateFace && waited;
    if (wanted && changed) return { next: "read", state: { ...s, clears: 0 } };
    return { next: "turn", state: { ...s, clears: 0, sinceRead: s.sinceRead + 1, sawOtherFace: s.sawOtherFace || !dateFace } };
  }
  if (!s.ready) return { next: "next", state: { ...s, clears: 0 } };
  if (!dateFace) return { next: "turn", state: { ...s, clears: 0 } };
  // The same view the cloud could not read a moment ago is not sent again.
  return { next: changed ? "read" : "again", state: { ...s, clears: 0 } };
}

/**
 * The watch state after a read came back (null: the read failed and nothing is known).
 * `laptopOnly`: the laptop itself said "turn it" and nothing was sent, so the face it saw is
 * known to have no date, and the first date face after it is already another face.
 */
export function afterRead(s: WatchState, step: Step | null, laptopOnly = false): WatchState {
  if (!step || step.kind === "no_item") return s;
  if (step.kind === "need_date_photo") {
    return { ...s, ready: true, pending: step.want === "name" ? "name" : "date", sinceRead: 0, sawOtherFace: laptopOnly, tries: s.pending ? s.tries + 1 : 0 };
  }
  return { ...WATCH_START, ready: false };
}

const WORSE_THAN_NONE = new Set(["dent", "bulge", "rust", "leak", "open"]);

/**
 * One item is often two photos: the front shows the name and no date, the top shows the date
 * and no name. This is the item as all its photos together show it: for each fact, the latest
 * photo that shows it. Nothing is filled in that no photo showed.
 */
export function itemFacts(reads: ReadResult[]): ItemRead {
  const last = reads[reads.length - 1].read;
  const latest = (has: (r: ItemRead) => boolean) => [...reads].reverse().find((r) => has(r.read))?.read;
  const named = latest((r) => Boolean(r.product || r.brand));
  const rowed = latest((r) => r.category !== "unclear");
  const dated = latest((r) => Boolean(r.date_text));
  const damaged = latest((r) => WORSE_THAN_NONE.has(r.damage));
  return {
    ...last,
    product: named?.product ?? "",
    brand: named?.brand ?? "",
    category: rowed?.category ?? "unclear",
    date_text: dated?.date_text ?? "",
    date_kind: dated?.date_kind ?? last.date_kind,
    damage: damaged?.damage ?? last.damage,
  };
}

/** What earlier photos showed, as one line for the next read's prompt. */
function seenSoFar(reads: ReadResult[]): string | undefined {
  if (!reads.length) return undefined;
  const f = itemFacts(reads);
  const parts = [
    f.product || f.brand ? `name "${[f.brand, f.product].filter(Boolean).join(" ")}"` : "",
    f.category !== "unclear" ? `chart row ${f.category}` : "",
    f.date_text ? `date "${f.date_text}"` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function withBudget<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`took over ${Math.round(ms / 1000)} s`)), ms);
    work.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

function settle(reads: ReadResult[], today: string, policy: Policy | undefined, route: string): Step {
  const last = itemFacts(reads);
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
    // The confirming read is never told what the first read found: a read primed with the
    // date could copy it and "confirm" it (found by a cold review, 2026-11-20). If this photo
    // does not show the date itself (the front of a two-photo item), the reads disagree and a
    // person checks it.
    check = await readItem(checker.model, checker.mode, jpegBase64, { ...readContext, seen: undefined });
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
function objectiveProblem(r: ReadResult | ItemRead, today: string): string | undefined {
  const read = "read" in r ? r.read : r;
  if (read.category === "unclear") return "no chart category";
  if (read.date_kind !== "none_visible") {
    if (!read.date_text) return "date kind given but no date characters";
    const p = parseDateText(read.date_text, today);
    if (p.kind === "unreadable") return `date "${read.date_text}" does not parse (${p.why})`;
  }
  return undefined;
}

export async function processItem(models: LoopModels, jpegBase64: string, ctx: ItemContext): Promise<Step> {
  const reads = [...(ctx.previous ?? [])];
  const secondLook = reads.length > 0;
  const readContext = { barcodeProduct: ctx.barcodeProduct, secondLook, seen: seenSoFar(reads) };
  const budget = ctx.triageBudgetMs ?? 20000;

  // Triage first, on the laptop, when this browser can do it. Measured on real Gemini Nano,
  // triage is the job it does well (10 of 15) and the full read is not (4 of 15), so with
  // triage the full read goes to the cloud, and only for photos worth reading.
  const useTriage = Boolean(models.triage && models.cloud);
  let fallback = "";
  if (useTriage && !secondLook) {
    try {
      let tr = ctx.triaged;
      try {
        tr ??= await withBudget(triageItem(models.triage!.model, jpegBase64), budget);
      } catch (e) {
        if (!ctx.smallJpeg || !/too large/i.test((e as Error).message)) throw e;
        fallback = "on_device triage: photo too large, retried smaller → ";
        tr = await withBudget(triageItem(models.triage!.model, ctx.smallJpeg), budget);
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

  // After a turn, the item is everything its photos showed together. When that is enough for
  // the chart (a row, and a date that parses), it is settled here, whatever this one photo lacks.
  if (secondLook && first.read.next_action !== "no_item" && first.read.next_action !== "set_aside") {
    const facts = itemFacts(reads);
    if (facts.date_text && !objectiveProblem(facts, ctx.today)) {
      return confirmDiscard(settle(reads, ctx.today, ctx.policy, routed(`${first.source}: photos together give the row and the date`)), models, jpegBase64, readContext, ctx.today);
    }
  }

  // A hands-free second look that does not settle the item leaves it waiting (see ItemContext).
  if (secondLook && ctx.watching && first.read.next_action !== "set_aside") {
    if (first.read.next_action === "no_item") {
      return { kind: "need_date_photo", want: ctx.want, reads: ctx.previous!, route: routed("hands-free: nothing new in this look; still waiting") };
    }
    const facts = itemFacts(reads);
    const want = facts.date_text && facts.category === "unclear" ? ("name" as const) : undefined;
    return { kind: "need_date_photo", want, reads, route: routed(`hands-free: not settled yet; waiting for the ${want ?? "date"}`) };
  }

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
      // The date is read and the name is not in view (a carton top, a can lid): ask for the
      // front rather than guess the chart row or give up on the item.
      if (problem === "no chart category" && !secondLook && first.source === "in_cloud" && first.read.date_text) {
        return { kind: "need_date_photo", want: "name", reads, route: routed("in_cloud: date read, no name in view; asked for the front") };
      }
      if (problem) return escalate(problem);
      return confirmDiscard(settle(reads, ctx.today, ctx.policy, routed(`${first.source}: model chose log`)), models, jpegBase64, readContext, ctx.today);
    }
  }
}
