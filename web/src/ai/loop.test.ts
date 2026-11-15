import { describe, expect, it, vi } from "vitest";

// The loop under test talks to Firebase only through readItem's model and trace calls, so
// both are replaced with fakes: these tests run offline and never call a model.
vi.mock("../firebase", () => ({ ai: {}, perf: {} }));
vi.mock("firebase/performance", () => ({
  trace: () => ({ start() {}, stop() {}, putAttribute() {}, putMetric() {} }),
}));

import type { GenerativeModel } from "firebase/ai";
import { processItem, type LoopModels } from "./loop";

const TODAY = "2026-11-15";

function read(fields: Record<string, string>): string {
  return JSON.stringify({
    product: "Chicken broth 900 mL",
    brand: "Campbell's",
    category: "canned_prepared_meals",
    date_text: "2027 FE 14",
    date_kind: "best_before",
    damage: "none",
    confidence: "high",
    next_action: "log",
    why: "date readable",
    ...fields,
  });
}

type Reply = { text: string; source: "on_device" | "in_cloud" } | Error;

function fakeModel(replies: Reply[]): GenerativeModel & { calls: number } {
  const queue = [...replies];
  const m = {
    calls: 0,
    async generateContent() {
      m.calls++;
      const r = queue.shift();
      if (!r) throw new Error("no more fake replies");
      if (r instanceof Error) throw r;
      return { response: { text: () => r.text, inferenceSource: r.source } };
    },
  };
  return m as unknown as GenerativeModel & { calls: number };
}

function models(hybrid: Reply[], cloud: Reply[] | null): { m: LoopModels; h: ReturnType<typeof fakeModel>; c: ReturnType<typeof fakeModel> | null } {
  const h = fakeModel(hybrid);
  const c = cloud ? fakeModel(cloud) : null;
  return {
    m: {
      hybrid: { model: h, mode: "prefer_on_device" },
      cloud: c ? { model: c, mode: "only_in_cloud" } : null,
    },
    h,
    c,
  };
}

describe("processItem: the hybrid hand-off", () => {
  it("logs an on-device read that the chart gate can settle", async () => {
    const { m, c } = models([{ text: read({}), source: "on_device" }], [{ text: read({}), source: "in_cloud" }]);
    const step = await processItem(m, "img", { today: TODAY });
    expect(step.kind).toBe("verdict");
    if (step.kind === "verdict") {
      expect(step.verdict.decision).toBe("KEEP");
      expect(step.route).toBe("on_device: model chose log");
    }
    expect(c!.calls).toBe(0);
  });

  it("hands the photo to the cloud when the on-device call fails", async () => {
    const { m, c } = models([new Error("The input is too large.")], [{ text: read({}), source: "in_cloud" }]);
    const step = await processItem(m, "img", { today: TODAY });
    expect(step.kind).toBe("verdict");
    expect(step.route).toMatch(/^on-device failed \(The input is too large\.\) → in_cloud: model chose log$/);
    expect(c!.calls).toBe(1);
  });

  it("hands the photo to the cloud when the on-device answer is not JSON", async () => {
    const { m, c } = models([{ text: "On-device model is not available, echoing input", source: "on_device" }], [{ text: read({}), source: "in_cloud" }]);
    const step = await processItem(m, "img", { today: TODAY });
    expect(step.kind).toBe("verdict");
    expect(step.route.startsWith("on-device answer was not valid JSON → ")).toBe(true);
    expect(step.reads.map((r) => r.source)).toEqual(["on_device", "in_cloud"]);
    expect(c!.calls).toBe(1);
  });

  it("never calls the cloud in on-device-only mode, and sets the item aside instead", async () => {
    const { m } = models([{ text: read({ next_action: "ask_cloud", why: "stamp is smudged" }), source: "on_device" }], null);
    const step = await processItem(m, "img", { today: TODAY });
    expect(step.kind).toBe("verdict");
    if (step.kind === "verdict") expect(step.verdict.decision).toBe("SET_ASIDE");
    expect(step.route).toMatch(/cloud switched off/);
  });

  it("escalates a 'log' whose date does not parse, instead of logging it", async () => {
    const { m, c } = models(
      [{ text: read({ date_text: "L23 0419" }), source: "on_device" }],
      [{ text: read({}), source: "in_cloud" }],
    );
    const step = await processItem(m, "img", { today: TODAY });
    expect(c!.calls).toBe(1);
    expect(step.route).toMatch(/does not parse/);
  });

  it("waits out a cloud rate limit instead of failing the read", async () => {
    const limited = new Error("[429 ] You exceeded your current quota ... Please retry in 0.01s.");
    const { m, c } = models([new Error("The input is too large.")], [limited, { text: read({}), source: "in_cloud" }]);
    const step = await processItem(m, "img", { today: TODAY });
    expect(step.kind).toBe("verdict");
    expect(c!.calls).toBe(2);
  });

  it("keeps a discard only when a second read finds the same date", async () => {
    const cereal = { category: "boxed_cereal", product: "Corn flakes", date_text: "2026 FE 01" };
    const { m, c } = models([{ text: read(cereal), source: "on_device" }], [{ text: read(cereal), source: "in_cloud" }]);
    const step = await processItem(m, "img", { today: TODAY });
    expect(c!.calls).toBe(1);
    expect(step.kind === "verdict" && step.verdict.decision).toBe("DISCARD");
    expect(step.route).toMatch(/discard confirmed by a second read \(in_cloud\)$/);
  });

  it("sets an item aside instead of binning it when the two reads disagree on the date", async () => {
    // The real case: one read of a Chipits bag gave "26MA14" (May 2026), another "BB/MA 2027 MA 17".
    const { m } = models(
      [{ text: read({ category: "general_grocery_boxed", date_text: "26MA14" }), source: "on_device" }],
      [{ text: read({ category: "general_grocery_boxed", date_text: "BB/MA 2027 MA 17" }), source: "in_cloud" }],
    );
    const step = await processItem(m, "img", { today: TODAY });
    expect(step.kind === "verdict" && step.verdict.decision).toBe("SET_ASIDE");
    if (step.kind === "verdict") expect(step.verdict.reason).toMatch(/2026-05-14 vs 2027-05-17/);
  });

  it("refuses an on-device-only read in a browser with no on-device model, before any request", async () => {
    const h = fakeModel([{ text: read({}), source: "in_cloud" }]);
    const m: LoopModels = { hybrid: { model: h, mode: "only_on_device" }, cloud: null };
    await expect(processItem(m, "img", { today: TODAY })).rejects.toThrow(/photo was not sent anywhere/);
    expect(h.calls).toBe(0);
  });

  describe("on-device triage first", () => {
    const triageReply = (t: Record<string, unknown>): Reply => ({
      text: JSON.stringify({ package_in_view: true, date_in_view: false, needs_refrigeration: false, product: "Corn", ...t }),
      source: "on_device",
    });
    const withLanguageModel = async <T>(fn: () => Promise<T>) => {
      const g = globalThis as { LanguageModel?: unknown };
      g.LanguageModel = {};
      try {
        return await fn();
      } finally {
        delete g.LanguageModel;
      }
    };

    it("answers 'turn it' on the laptop when no date is in view, with no cloud call", async () => {
      const t = fakeModel([triageReply({})]);
      const { m, c } = models([], [{ text: read({}), source: "in_cloud" }]);
      m.triage = { model: t };
      const step = await withLanguageModel(() => processItem(m, "img", { today: TODAY }));
      expect(step.kind).toBe("need_date_photo");
      expect(step.route).toBe("on_device triage: no date in view; no cloud call");
      expect(c!.calls).toBe(0);
    });

    it("sends the photo to the cloud for the date when triage sees one", async () => {
      const t = fakeModel([triageReply({ date_in_view: true })]);
      const { m, h, c } = models([], [{ text: read({}), source: "in_cloud" }]);
      m.triage = { model: t };
      const step = await withLanguageModel(() => processItem(m, "img", { today: TODAY }));
      expect(step.kind === "verdict" && step.verdict.decision).toBe("KEEP");
      expect(step.route).toBe("on_device triage: date in view → in_cloud: model chose log");
      expect(step.reads.map((r) => r.source)).toEqual(["on_device", "in_cloud"]);
      expect(h.calls).toBe(0);
      expect(c!.calls).toBe(1);
    });

    it("reads in the cloud when triage fails, so no item is lost", async () => {
      const t = fakeModel([new Error("model crashed")]);
      const { m, c } = models([], [{ text: read({}), source: "in_cloud" }]);
      m.triage = { model: t };
      const step = await withLanguageModel(() => processItem(m, "img", { today: TODAY }));
      expect(step.kind).toBe("verdict");
      expect(step.route.startsWith("on-device triage failed (model crashed) → ")).toBe(true);
      expect(c!.calls).toBe(1);
    });
  });

  it("treats an empty frame as no item, so the next item starts fresh", async () => {
    const { m } = models([{ text: read({ next_action: "no_item", product: "", category: "unclear", date_text: "", date_kind: "none_visible" }), source: "on_device" }], []);
    const step = await processItem(m, "img", { today: TODAY });
    expect(step.kind).toBe("no_item");
  });
});
