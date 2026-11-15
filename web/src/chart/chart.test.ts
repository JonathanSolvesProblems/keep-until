import { describe, expect, it } from "vitest";
import { parseDateText } from "./dates";
import { CHART, gate } from "./chart";

const TODAY = "2026-11-14";

describe("parseDateText: implausible years", () => {
  it("refuses a misread year far from the sort date (cloud read '5037' for a cut-off '2027')", () => {
    expect(parseDateText("BB/MA 5037 MA", TODAY).kind).toBe("unreadable");
    expect(parseDateText("2097 FE 14", TODAY).kind).toBe("unreadable");
    expect(parseDateText("1999 FE 14", TODAY).kind).toBe("unreadable");
  });
  it("still reads stamps a few years either side", () => {
    expect(parseDateText("2027 FE 14", TODAY)).toEqual({ kind: "exact", iso: "2027-02-14", precision: "day" });
    expect(parseDateText("2019 JA 05", TODAY).kind).toBe("exact");
  });
});

describe("parseDateText: CFIA stamps", () => {
  it("reads year, bilingual month symbol, day", () => {
    expect(parseDateText("BB/MA 2025 JA 14", TODAY)).toEqual({ kind: "exact", iso: "2025-01-14", precision: "day" });
    expect(parseDateText("17 JN 28", TODAY)).toEqual({ kind: "exact", iso: "2017-06-28", precision: "day" });
    expect(parseDateText("26JA14", TODAY)).toEqual({ kind: "exact", iso: "2026-01-14", precision: "day" });
  });

  it("does not mistake the MA of BB MA for May", () => {
    expect(parseDateText("BB MA 2026 JA 14", TODAY)).toEqual({ kind: "exact", iso: "2026-01-14", precision: "day" });
    expect(parseDateText("MEILLEUR AVANT 2027 FE 03", TODAY)).toEqual({ kind: "exact", iso: "2027-02-03", precision: "day" });
  });

  it("still reads MA as May when it is the month", () => {
    expect(parseDateText("2027 MA 09", TODAY)).toEqual({ kind: "exact", iso: "2027-05-09", precision: "day" });
  });

  it("ignores a lot code on the same line", () => {
    expect(parseDateText("L2345 26 JA 14", TODAY)).toEqual({ kind: "exact", iso: "2026-01-14", precision: "day" });
  });

  it("fills a missing year only when one year is plausible", () => {
    // Year left out (allowed by CFIA when clear): Dec 2 is 18 days ahead of the sort.
    expect(parseDateText("DE 02", TODAY)).toEqual({ kind: "exact", iso: "2026-12-02", precision: "day" });
    // June 28 with no year: last June, five months ago; next June is too far ahead to be plausible.
    expect(parseDateText("JN 28", TODAY)).toEqual({ kind: "exact", iso: "2026-06-28", precision: "day" });
  });
});

describe("parseDateText: imported formats", () => {
  it("reads English month words in either order", () => {
    expect(parseDateText("BEST BY JAN 14 2026", TODAY)).toEqual({ kind: "exact", iso: "2026-01-14", precision: "day" });
    expect(parseDateText("14 JAN 2026", TODAY)).toEqual({ kind: "exact", iso: "2026-01-14", precision: "day" });
    expect(parseDateText("EXP MAR 2027", TODAY)).toEqual({ kind: "exact", iso: "2027-03-01", precision: "month" });
  });

  it("refuses to guess between day-month and month-day", () => {
    const p = parseDateText("03/04/2026", TODAY);
    expect(p.kind).toBe("ambiguous");
    if (p.kind === "ambiguous") expect(p.candidates).toEqual(["2026-03-04", "2026-04-03"]);
    expect(parseDateText("25/04/2026", TODAY)).toEqual({ kind: "exact", iso: "2026-04-25", precision: "day" });
  });

  it("treats a solid run of digits as a lot code, not a date", () => {
    expect(parseDateText("260114", TODAY).kind).toBe("unreadable");
  });
});

describe("gate: the Food Banks Canada chart", () => {
  it("keeps canned vegetables 12 months past best before by default", () => {
    const v = gate({ categoryId: "canned_fruit_veg", date: parseDateText("2026 MR 14", TODAY), dateKind: "best_before", damage: "none", today: TODAY });
    expect(v.decision).toBe("KEEP");
    expect(v.keepUntil).toBe("2027-03-14");
    expect(v.pastPrintedDate).toBe(true);
    expect(v.chart?.page).toBe(4);
  });

  it("discards canned vegetables once 12 months past best before have run out", () => {
    const v = gate({ categoryId: "canned_fruit_veg", date: parseDateText("2025 JA 14", TODAY), dateKind: "best_before", damage: "none", today: TODAY });
    expect(v.decision).toBe("DISCARD");
    expect(v.keepUntil).toBe("2026-01-14");
  });

  it("discards once the chart's limit has passed", () => {
    const v = gate({ categoryId: "boxed_cereal", date: parseDateText("2026 FE 01", TODAY), dateKind: "best_before", damage: "none", today: TODAY });
    expect(v.decision).toBe("DISCARD");
    expect(v.keepUntil).toBe("2026-08-01");
  });

  it("uses the food bank's own policy when Remote Config sets one", () => {
    const date = parseDateText("2025 AU 01", TODAY);
    const strict = gate({ categoryId: "canned_fruit_veg", date, dateKind: "best_before", damage: "none", today: TODAY });
    const calgary = gate({
      categoryId: "canned_fruit_veg", date, dateKind: "best_before", damage: "none", today: TODAY,
      policy: { bound: "min", overrides: { canned_fruit_veg: { rule: "months", value: 18 } } },
    });
    // Same can, two policies: the chart's lower bound has run out, an 18-month policy has not.
    expect(strict.decision).toBe("DISCARD");
    expect(strict.keepUntil).toBe("2026-08-01");
    expect(calgary.decision).toBe("KEEP");
    expect(calgary.keepUntil).toBe("2027-02-01");
  });

  it("never keeps infant formula past its expiry date", () => {
    const v = gate({ categoryId: "infant_formula", date: parseDateText("EXP 2026 NO 01", TODAY), dateKind: "expiry", damage: "none", today: TODAY });
    expect(v.decision).toBe("DISCARD");
  });

  it("sends damaged packaging and chilled food to the lead", () => {
    expect(gate({ categoryId: "canned_prepared_meals", date: parseDateText("2027 JA 01", TODAY), dateKind: "best_before", damage: "dent", today: TODAY }).decision).toBe("SET_ASIDE");
    expect(gate({ categoryId: "chilled_or_frozen", date: null, dateKind: "none_visible", damage: "none", today: TODAY }).decision).toBe("SET_ASIDE");
  });

  it("decides an ambiguous stamp only when both readings agree", () => {
    const agree = gate({ categoryId: "canned_fruit_veg", date: parseDateText("03/04/2026", TODAY), dateKind: "best_before", damage: "none", today: TODAY });
    expect(agree.decision).toBe("KEEP");
    expect(agree.keepUntil).toBe("2027-03-04");
    const disagree = gate({ categoryId: "crackers_cookies", date: parseDateText("10/11/2026", TODAY), dateKind: "best_before", damage: "none", today: TODAY });
    expect(disagree.decision).toBe("SET_ASIDE");
  });

  it("has a page and a valid rule for every chart row", () => {
    for (const row of CHART.categories) {
      expect(row.page).toBeGreaterThanOrEqual(2);
      if (row.rule === "months" || row.rule === "days") {
        expect(row.min).toBeGreaterThan(0);
        expect(row.max).toBeGreaterThanOrEqual(row.min!);
      }
    }
  });
});
