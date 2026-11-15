import { describe, expect, it } from "vitest";
import { plainReason } from "./view";

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
