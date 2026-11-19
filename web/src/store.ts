// Writes the shift and the item log to Firestore in exactly the shape firestore.rules allows.
// Writes are not awaited: with the persistent cache they land on the laptop at once and sync
// when the network is back.

import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Step } from "./ai/loop";
import { chartRow, type Policy } from "./chart/chart";
import { viewOf } from "./view";

export interface ShiftInfo {
  foodBankId: string;
  uid: string;
  mode: string;
  onDevice: string;
  cloudModel: string;
}

/** The shift id is made on the laptop, so a shift can start with no network at all. */
export function startShift(info: ShiftInfo): string {
  const ref = doc(collection(db, "foodBanks", info.foodBankId, "shifts"));
  setDoc(ref, {
    startedBy: info.uid,
    startedAt: serverTimestamp(),
    mode: info.mode,
    platform: "web",
    onDevice: info.onDevice,
    cloudModel: info.cloudModel,
  }).catch((e) => console.error("shift start failed", e));
  return ref.id;
}

function describePolicy(policy: Policy | undefined, categoryId: string): string {
  const o = policy?.overrides?.[categoryId];
  if (o) return `food bank policy: ${o.value} ${o.rule}`;
  return `chart ${policy?.bound ?? "min"} bound`;
}

export function logItem(foodBankId: string, shiftId: string, uid: string, step: Extract<Step, { kind: "verdict" }>, policy?: Policy): { id: string; sheetRow: string[] } {
  const last = step.reads[step.reads.length - 1]?.read;
  const parsed = step.parsed;
  const record = {
    createdBy: uid,
    createdAt: serverTimestamp(),
    shiftId,
    platform: "web",
    product: last?.product ?? "",
    brand: last?.brand ?? "",
    category: last?.category ?? "",
    dateText: last?.date_text ?? "",
    dateKind: last?.date_kind ?? "none_visible",
    parsedDate:
      parsed?.kind === "exact" ? parsed.iso : parsed?.kind === "ambiguous" ? parsed.candidates.join(" | ") : null,
    damage: last?.damage ?? "unsure",
    decision: step.verdict.decision,
    keepUntil: step.verdict.keepUntil ?? null,
    pastPrintedDate: step.verdict.pastPrintedDate,
    reason: step.verdict.reason,
    chartPage: step.verdict.chart?.page ?? null,
    policy: describePolicy(policy, last?.category ?? ""),
    route: step.route,
    // What the model chose at each read and where it ran: the loop, kept with the record.
    reads: step.reads.map((r) => ({
      source: r.source,
      ms: r.ms,
      mode: r.mode,
      nextAction: r.read.next_action,
      confidence: r.read.confidence,
      why: r.read.why,
    })),
    barcode: null,
  };
  const ref = doc(collection(db, "foodBanks", foodBankId, "items"));
  setDoc(ref, record).catch((e) => console.error("item log failed", e));
  // The sheet is the food bank's own record, so it gets the words the volunteer saw, not ids.
  const v = viewOf(step);
  const kindWords: Record<string, string> = { best_before: "Best before", expiry: "Expiry", packaged_on: "Packaged on", none_visible: "None visible" };
  return {
    id: ref.id,
    // The same item as a row for the food bank's own sheet.
    sheetRow: [
      new Date().toLocaleString("en-CA"),
      record.product,
      record.brand,
      step.verdict.chart?.label ?? chartRow(record.category)?.label ?? record.category,
      record.dateText,
      kindWords[record.dateKind] ?? record.dateKind,
      v.word,
      record.keepUntil ?? "",
      v.reason,
      record.chartPage === null ? "" : String(record.chartPage),
      step.reads.map((r) => (r.source === "on_device" ? "this laptop" : "cloud")).join(", then "),
      ref.id,
    ],
  };
}
