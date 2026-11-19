// The rule half of the recall watch: which kept items share a brand with a food recall.
// It only proposes. A brand in common is not a recall match (Hershey's Kisses were recalled for
// almond in August 2026; Hershey's Chipits were not), so every candidate is settled at the next
// shift start by Gemini through Firebase AI Logic, which chooses pull, check the lot code, or
// no match (web/src/recall.ts).

const GENERIC = new Set(["brand", "certain", "the", "and", "food", "foods", "products", "product", "various"]);

/** Lower case, no accents, letters and digits only, single spaces. */
export function norm(s) {
  return ` ${String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/** CFIA notices are the food recalls in the Government of Canada feed. */
export function isFoodRecall(r) {
  return r.Organization === "CFIA";
}

/** A brand worth matching on: at least three letters and not a generic word. */
function usableBrand(brand) {
  const b = norm(brand).trim();
  return b.length >= 3 && !GENERIC.has(b) ? b : null;
}

/**
 * Candidates for one recall: kept items whose brand appears, as whole words, in the recall's
 * title or product list.
 */
export function candidatesFor(recall, items) {
  const text = norm(`${recall.Title ?? ""} ${recall.Product ?? ""}`);
  const out = [];
  for (const item of items) {
    const b = usableBrand(item.brand);
    if (!b || !text.includes(` ${b} `)) continue;
    out.push({
      itemId: item.id,
      brand: item.brand,
      product: item.product ?? "",
      dateText: item.dateText ?? "",
      keepUntil: item.keepUntil ?? null,
      why: `brand "${item.brand}" appears in the recall notice`,
    });
  }
  return out;
}

/** Food recalls updated on or after `since` (YYYY-MM-DD), newest first. */
export function recentFoodRecalls(feed, since) {
  return feed
    .filter((r) => isFoodRecall(r) && (r["Last updated"] ?? "") >= since)
    .sort((a, b) => (b["Last updated"] ?? "").localeCompare(a["Last updated"] ?? ""));
}

/** What gets written for a recall with candidates. */
export function recallDoc(recall, candidates, checkedAt) {
  return {
    nid: String(recall.NID),
    title: recall.Title ?? "",
    url: recall.URL ?? "",
    product: recall.Product ?? "",
    issue: recall.Issue ?? "",
    recallClass: recall["Recall class"] ?? "",
    category: recall.Category ?? "",
    lastUpdated: recall["Last updated"] ?? "",
    candidates,
    status: "check",
    checkedAt,
  };
}
