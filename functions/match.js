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

// Brands a label prints in short form, as the notices spell them out. Found by the second recall
// control set (2026-11-22): a "PC" item was never proposed against a "President's Choice" recall,
// so the model never saw it. Store brands only, from the notices in the feed.
const BRAND_ALIASES = { pc: "president s choice", "pc blue menu": "president s choice", "pc organics": "president s choice" };

/** The forms of a brand worth matching on: as printed, and spelled out when it is a known short form. */
function usableBrands(brand) {
  const raw = norm(brand).trim();
  return [...new Set([raw, BRAND_ALIASES[raw]])].filter((b) => b && b.length >= 3 && !GENERIC.has(b));
}

/**
 * Candidates for one recall: kept items whose brand appears, as whole words, in the recall's
 * title or product list.
 */
export function candidatesFor(recall, items) {
  const text = norm(`${recall.Title ?? ""} ${recall.Product ?? ""}`);
  const out = [];
  for (const item of items) {
    if (!usableBrands(item.brand).some((b) => text.includes(` ${b} `))) continue;
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

const NOT_PRODUCT_WORDS = new Set(["with", "from", "size", "pack", "organic", "style", "brand", "recalled", "certain", "various"]);

/** Product words of four or more letters, singular, without the brand's own words. */
function productWords(text, brand) {
  const skip = new Set(norm(brand).trim().split(" "));
  return new Set(
    norm(text)
      .trim()
      .split(" ")
      // One stem for singular and plural: cookie and cookies, berry and berries, sauce and sauces.
      .map((w) => w.replace(/(ies|ie|y)$/, "").replace(/(es|e|s)$/, ""))
      .filter((w) => w.length >= 4 && !NOT_PRODUCT_WORDS.has(w) && !skip.has(w)),
  );
}

/**
 * The fairer baseline the model is measured against (2026-11-22): pull only when the brand is in
 * the notice and the kept item's product shares at least one product word with the recalled
 * product. It never runs in the product; it exists so the model is compared with a rule a
 * careful programmer would write, and not only with brand matching.
 */
export function keywordRule(recall, item) {
  if (!candidatesFor(recall, [{ id: "x", brand: item.brand, product: item.product }]).length) return "no_match";
  const recalled = `${recall.Product ?? ""} ${String(recall.Title ?? "").split(/ recalled /i)[0]}`;
  const mine = productWords(item.product, item.brand);
  for (const w of productWords(recalled, item.brand)) if (mine.has(w)) return "pull";
  return "no_match";
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
