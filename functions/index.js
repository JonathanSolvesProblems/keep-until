// The recall watch: every morning, pull the Government of Canada recall feed and list each
// food bank's kept items that share a brand with a food recall from the past year. The model
// settles those candidates at the next shift start (web/src/recall.ts).

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { candidatesFor, recallDoc, recentFoodRecalls } from "./match.js";
import { FEED_URL, fetchFeed } from "./feed.js";

initializeApp();
const db = getFirestore();

export { FEED_URL };
const LOOKBACK_DAYS = 365;

export async function runRecallWatch(feed, today = new Date()) {
  const since = new Date(today.getTime() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
  const recalls = recentFoodRecalls(feed, since);
  const banks = await db.collection("foodBanks").listDocuments();
  const summary = [];
  for (const bank of banks) {
    const snap = await bank.collection("items").where("decision", "==", "KEEP").get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    let written = 0;
    for (const r of recalls) {
      const candidates = candidatesFor(r, items);
      if (!candidates.length) continue;
      const ref = bank.collection("recalls").doc(String(r.NID));
      const existing = await ref.get();
      // Never reopen a recall the model already settled for the same items.
      const known = new Set((existing.data()?.candidates ?? []).map((c) => c.itemId));
      if (existing.exists && candidates.every((c) => known.has(c.itemId))) continue;
      await ref.set(recallDoc(r, candidates, new Date().toISOString()));
      written++;
    }
    await bank.set(
      { recallWatch: { lastRun: FieldValue.serverTimestamp(), recallsInWindow: recalls.length, itemsWatched: items.length, newCandidates: written, feed: FEED_URL } },
      { merge: true },
    );
    summary.push({ bank: bank.id, items: items.length, written });
  }
  return { recalls: recalls.length, since, summary };
}

export const recallWatch = onSchedule(
  {
    schedule: "every day 06:00",
    timeZone: "America/Toronto",
    memory: "1GiB",
    timeoutSeconds: 300,
    region: "northamerica-northeast1",
    retryCount: 2,
    minBackoffSeconds: 600,
  },
  async () => {
    const feed = await fetchFeed();
    const out = await runRecallWatch(feed);
    logger.info("recall watch", out);
  },
);
