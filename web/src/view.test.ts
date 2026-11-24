import { describe, expect, it, vi } from "vitest";

// view.ts reads the item's facts through the loop, which imports Firebase; neither is called here.
vi.mock("./firebase", () => ({ ai: {}, perf: {}, db: {} }));
vi.mock("firebase/performance", () => ({ trace: () => ({ start() {}, stop() {}, putAttribute() {}, putMetric() {} }) }));

import { plainReason, spokenAnswer } from "./view";
import type { Step } from "./ai/loop";

describe("plainReason: the gate's reasons in the sort lead's words", () => {
  it("names the chart page as the source and drops it from the sentence", () => {
    expect(plainReason("Canned soup: 24 months past best before (chart p.8)")).toEqual({
      reason: "Canned soup keep 24 months past best before.",
      source: "Food Banks Canada chart, page 8",
    });
  });

  it("says 1 month, not 1 months, and leaves 11 months alone", () => {
    expect(plainReason("UHT milk: 1 months past best before (chart p.5)").reason).toBe("UHT milk keep 1 month past best before.");
    expect(plainReason("Cereal: 11 months past best before (chart p.3)").reason).toBe("Cereal keep 11 months past best before.");
  });

  it("never shows a raw parser message", () => {
    expect(plainReason('date "5037 MA" does not parse (year 5037 is not a plausible date stamp)').reason).toBe(
      "The date stamp could not be read clearly.",
    );
  });
});

describe("spokenAnswer: the answer said aloud says only what the screen shows", () => {
  const read = (over: Record<string, unknown>) => ({
    read: { product: "Chicken Broth", brand: "Campbell's", category: "canned_soup", date_text: "2027 FE 14", date_kind: "best_before", damage: "none", confidence: "high", next_action: "log", why: "", ...over },
    source: "in_cloud",
    ms: 1200,
    mode: "only_in_cloud",
    valid: true,
  });
  const verdict = (v: Record<string, unknown>, r = read({})) =>
    ({ kind: "verdict", reads: [r], parsed: { kind: "exact", iso: "2027-02-14" }, verdict: { pastPrintedDate: false, reason: "Canned soup: 24 months past best before (chart p.8)", ...v }, route: "" }) as unknown as Step;

  it("says keep and the keep-until date in words", () => {
    expect(spokenAnswer(verdict({ decision: "KEEP", keepUntil: "2029-02-14" }))).toBe("Keep. Until 14 February 2029.");
  });
  it("says why an item is set aside, in the lead's words", () => {
    const step = verdict({ decision: "SET_ASIDE", reason: "needs refrigeration" }, read({ category: "chilled_or_frozen" }));
    expect(spokenAnswer(step)).toBe("Set aside for the lead. Needs the fridge. The lead checks the cold chain.");
  });
  it("asks for the item to be turned, and stays silent over an empty table", () => {
    expect(spokenAnswer({ kind: "need_date_photo", reads: [], route: "" })).toBe("Turn it, so the date faces the camera.");
    expect(spokenAnswer({ kind: "no_item", reads: [], route: "" })).toBe("");
  });
});
