// The model half of the recall watch. The scheduled function (functions/index.js) proposes kept
// items that share a brand with a food recall; at shift start Gemini settles each one, choosing
// pull, check the lot code, or no match. This feature prefers the cloud (the notice text is
// public and the call is text only) and falls back to Gemini Nano on the laptop when offline:
// the second inference policy in the app, chosen per feature.

import { getGenerativeModel, InferenceMode, ThinkingLevel, type GenerativeModel } from "firebase/ai";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { ai, db } from "./firebase";

export const RECALL_DECISIONS = ["pull", "check_lot", "no_match"] as const;
export type RecallDecision = (typeof RECALL_DECISIONS)[number];

export const RECALL_SCHEMA = {
  type: "object",
  properties: {
    decision: { type: "string", enum: [...RECALL_DECISIONS] },
    why: { type: "string", description: "One short sentence naming what in the notice decided it." },
  },
  required: ["decision", "why"],
} as const;

export interface Notice {
  nid: string;
  title: string;
  url: string;
  product: string;
  issue: string;
  recallClass: string;
  lastUpdated: string;
}

export interface Kept {
  id: string;
  brand: string;
  product: string;
  dateText?: string;
}

export interface Settled {
  decision: RecallDecision;
  why: string;
  source: "on_device" | "in_cloud";
  ms: number;
}

export function makeRecallModel(cloudModel: string): GenerativeModel {
  return getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_IN_CLOUD,
    onDeviceParams: {
      createOptions: { expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] },
      promptOptions: { responseConstraint: RECALL_SCHEMA },
    },
    inCloudParams: {
      model: cloudModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: RECALL_SCHEMA,
        temperature: 0,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL as never },
      },
    },
  });
}

export function recallPrompt(n: Notice, item: Kept): string {
  return [
    "A Canadian food bank kept one donated item. A Government of Canada food recall notice names the same brand.",
    "Decide from the text only whether the kept item is a recalled product.",
    "",
    `Kept item: brand "${item.brand}", product "${item.product}"${item.dateText ? `, date on package "${item.dateText}"` : ""}.`,
    `Recall notice: "${n.title}". Recalled products: "${n.product}". Reason: ${n.issue}. ${n.recallClass}. Updated ${n.lastUpdated}.`,
    "",
    "decision:",
    "- pull: the kept item is the recalled product (same brand and the same kind of product).",
    "- check_lot: it may be the recalled product, but only a lot code, size or date on the package can tell; the lead checks the package against the notice.",
    "- no_match: same brand, but a different product than the ones recalled.",
  ].join("\n");
}

export async function settle(model: GenerativeModel, n: Notice, item: Kept): Promise<Settled> {
  const t0 = performance.now();
  const result = await model.generateContent(recallPrompt(n, item));
  const raw = JSON.parse(result.response.text()) as { decision?: string; why?: string };
  if (!RECALL_DECISIONS.includes(raw.decision as RecallDecision)) throw new Error(`not a recall decision: ${raw.decision}`);
  return {
    decision: raw.decision as RecallDecision,
    why: raw.why ?? "",
    source: result.response.inferenceSource === "on_device" ? "on_device" : "in_cloud",
    ms: Math.round(performance.now() - t0),
  };
}

export interface Found {
  notice: Notice;
  item: Kept;
  settled: Settled;
  /** Settled at this shift start (not read back from an earlier one). */
  fresh: boolean;
}

export interface ShiftRecallCheck {
  toPull: Found[];
  toCheck: Found[];
  cleared: number;
  watch?: { lastRun?: { toDate(): Date }; recallsInWindow?: number; itemsWatched?: number };
}

/**
 * Settles every open candidate for this food bank and records each decision. A candidate the
 * model already settled is read back, never asked again.
 */
export async function checkRecallsAtShiftStart(foodBankId: string, uid: string, model: GenerativeModel): Promise<ShiftRecallCheck> {
  const bank = await getDoc(doc(db, "foodBanks", foodBankId));
  const out: ShiftRecallCheck = { toPull: [], toCheck: [], cleared: 0, watch: bank.data()?.recallWatch };
  const open = await getDocs(query(collection(db, "foodBanks", foodBankId, "recalls"), where("status", "==", "check")));
  for (const r of open.docs) {
    const d = r.data();
    const notice: Notice = { nid: d.nid, title: d.title, url: d.url, product: d.product, issue: d.issue, recallClass: d.recallClass, lastUpdated: d.lastUpdated };
    for (const c of d.candidates as { itemId: string; brand: string; product: string; dateText?: string }[]) {
      const item: Kept = { id: c.itemId, brand: c.brand, product: c.product, dateText: c.dateText };
      const ref = doc(db, "foodBanks", foodBankId, "recallChecks", `${notice.nid}_${item.id}`);
      const done = await getDoc(ref);
      let settled: Settled;
      const fresh = !done.exists();
      if (done.exists()) {
        const x = done.data();
        settled = { decision: x.decision, why: x.why, source: x.source, ms: x.ms };
      } else {
        settled = await settle(model, notice, item);
        await setDoc(ref, { nid: notice.nid, itemId: item.id, ...settled, createdBy: uid, createdAt: serverTimestamp() });
      }
      if (settled.decision === "pull") out.toPull.push({ notice, item, settled, fresh });
      else if (settled.decision === "check_lot") out.toCheck.push({ notice, item, settled, fresh });
      else out.cleared++;
    }
  }
  return out;
}
