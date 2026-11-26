import { describe, expect, it, vi } from "vitest";

// The loop under test talks to Firebase only through readItem's model and trace calls, so
// both are replaced with fakes: these tests run offline and never call a model.
vi.mock("../firebase", () => ({ ai: {}, perf: {} }));
vi.mock("firebase/performance", () => ({
  trace: () => ({ start() {}, stop() {}, putAttribute() {}, putMetric() {} }),
}));

import type { GenerativeModel } from "firebase/ai";
import { afterRead, processItem, watchStep, WATCH_START, type LoopModels, type Step } from "./loop";

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

    it("retries the laptop check with the smaller photo when Nano says the input is too large", async () => {
      // Seen on 2026-11-16: a webcam frame was refused and the read silently went to the cloud.
      const t = fakeModel([new Error("The input is too large."), triageReply({ date_in_view: true })]);
      const { m, c } = models([], [{ text: read({}), source: "in_cloud" }]);
      m.triage = { model: t };
      const step = await withLanguageModel(() => processItem(m, "img", { today: TODAY, smallJpeg: "small" }));
      expect(t.calls).toBe(2);
      expect(step.route).toBe("on_device triage: photo too large, retried smaller → on_device triage: date in view → in_cloud: model chose log");
      expect(step.reads.map((r) => r.source)).toEqual(["on_device", "in_cloud"]);
      expect(c!.calls).toBe(1);
    });

    it("hands-free: uses the laptop's look at the frame instead of checking it twice", async () => {
      const t = fakeModel([]);
      const { m, c } = models([], [{ text: read({}), source: "in_cloud" }]);
      m.triage = { model: t };
      const triaged = { triage: { package_in_view: true, date_in_view: true, needs_refrigeration: false, product: "Corn" }, ms: 900 };
      const step = await withLanguageModel(() => processItem(m, "img", { today: TODAY, triaged }));
      expect(step.kind === "verdict" && step.verdict.decision).toBe("KEEP");
      expect(t.calls).toBe(0);
      expect(c!.calls).toBe(1);
      expect(step.reads[0].ms).toBe(900);
    });
  });

  it("treats an empty frame as no item, so the next item starts fresh", async () => {
    const { m } = models([{ text: read({ next_action: "no_item", product: "", category: "unclear", date_text: "", date_kind: "none_visible" }), source: "on_device" }], []);
    const step = await processItem(m, "img", { today: TODAY });
    expect(step.kind).toBe("no_item");
  });
});

describe("one item, two photos (front for the name, top for the date)", () => {
  const front = read({ product: "Chicken broth 900 mL", brand: "Campbell's", category: "canned_prepared_meals", date_text: "", date_kind: "none_visible", next_action: "show_me_the_date" });
  const top = read({ product: "", brand: "", category: "unclear", date_text: "2027 FE 14", date_kind: "best_before", next_action: "log" });

  it("asks for the name when the cloud reads a date but cannot tell the chart row", async () => {
    const { m } = models([], [{ text: top, source: "in_cloud" }]);
    m.hybrid = m.cloud!;
    const step = await processItem(m, "img", { today: TODAY });
    expect(step.kind).toBe("need_date_photo");
    expect(step.kind === "need_date_photo" && step.want).toBe("name");
  });

  it("settles from the front's name and row plus the top's date", async () => {
    const { m } = models([], [{ text: front, source: "in_cloud" }, { text: top, source: "in_cloud" }]);
    m.hybrid = m.cloud!;
    const first = await processItem(m, "front", { today: TODAY });
    expect(first.kind).toBe("need_date_photo");
    const second = await processItem(m, "top", { today: TODAY, previous: first.reads });
    expect(second.kind === "verdict" && second.verdict.decision).toBe("KEEP");
    expect(second.kind === "verdict" && second.verdict.chart?.id).toBe("canned_prepared_meals");
    expect(second.kind === "verdict" && second.parsed?.kind === "exact" && second.parsed.iso).toBe("2027-02-14");
    expect(second.route).toBe("in_cloud: photos together give the row and the date");
  });

  it("never fills in a fact no photo showed", async () => {
    const { itemFacts } = await import("./loop");
    const f = itemFacts([{ read: JSON.parse(top), source: "in_cloud", ms: 1, mode: "only_in_cloud", valid: true }]);
    expect(f.category).toBe("unclear");
    expect(f.product).toBe("");
  });

  it("gives up on a laptop check that stalls and reads in the cloud", async () => {
    const stall = { calls: 0, generateContent: () => new Promise(() => {}) } as unknown as GenerativeModel;
    const { m, c } = models([], [{ text: read({}), source: "in_cloud" }]);
    m.triage = { model: stall };
    const g = globalThis as { LanguageModel?: unknown };
    g.LanguageModel = {};
    try {
      const step = await processItem(m, "img", { today: TODAY, triageBudgetMs: 30 });
      expect(step.kind).toBe("verdict");
      expect(step.route.startsWith("on-device triage failed (took over 0 s) → ")).toBe(true);
      expect(c!.calls).toBe(1);
    } finally {
      delete g.LanguageModel;
    }
  });
});

describe("the confirming read is independent", () => {
  it("never tells the confirming read the date the first read found", async () => {
    const front = read({ product: "Chicken broth 900 mL", brand: "Campbell's", category: "canned_prepared_meals", date_text: "", date_kind: "none_visible", next_action: "show_me_the_date" });
    const top = read({ product: "", brand: "", category: "unclear", date_text: "2024 FE 14", date_kind: "best_before", next_action: "log" });
    const prompts: string[] = [];
    const replies = [front, top, top];
    const cloud = {
      calls: 0,
      async generateContent(parts: { text?: string }[]) {
        cloud.calls++;
        prompts.push(parts.map((p) => p.text ?? "").join(" "));
        return { response: { text: () => replies.shift()!, inferenceSource: "in_cloud" } };
      },
    } as unknown as GenerativeModel & { calls: number };
    const m: LoopModels = { hybrid: { model: cloud, mode: "only_in_cloud" }, cloud: { model: cloud, mode: "only_in_cloud" } };
    const first = await processItem(m, "front", { today: "2027-06-01" });
    const second = await processItem(m, "top", { today: "2027-06-01", previous: first.reads });
    expect(second.kind === "verdict" && second.verdict.decision).toBe("DISCARD");
    expect(prompts[1]).toContain("Earlier photos of this same item showed");
    expect(prompts[2]).not.toContain("Earlier photos of this same item showed");
  });
});

describe("hands-free watching (the laptop decides when the cloud is asked)", () => {
  const t = (p: boolean, d: boolean, f = false) => ({ package_in_view: p, date_in_view: d, needs_refrigeration: f, product: "" });
  const turnStep = (want?: "name") => ({ kind: "need_date_photo", want, reads: [], route: "" }) as Step;
  const keepStep = { kind: "verdict", reads: [], parsed: null, verdict: { decision: "KEEP", pastPrintedDate: false, reason: "" }, route: "" } as unknown as Step;

  it("asks the cloud only when a package faces the camera with its date, or needs the fridge", () => {
    expect(watchStep(t(true, true), WATCH_START, true).next).toBe("read");
    expect(watchStep(t(true, false, true), WATCH_START, true).next).toBe("read");
    expect(watchStep(t(true, false), WATCH_START, true).next).toBe("turn");
    expect(watchStep(t(false, false), WATCH_START, true).next).toBe("clear");
  });

  it("never reads the same item twice: after an answer it waits for the table to clear", () => {
    const done = afterRead(WATCH_START, keepStep);
    expect(watchStep(t(true, true), done, true).next).toBe("next");
    const one = watchStep(t(false, false), done, true).state;
    expect(watchStep(t(true, true), one, true).next).toBe("next"); // one "nothing here" may be the laptop's mistake
    const two = watchStep(t(false, false), one, true).state;
    expect(watchStep(t(true, true), two, true).next).toBe("read");
  });

  it("date side first: the cloud asks for the name, and the front is read though it shows no date", () => {
    const asked = afterRead(WATCH_START, turnStep("name"));
    expect(asked.pending).toBe("name");
    expect(watchStep(t(true, false), asked, true).next).toBe("read");
    expect(watchStep(t(true, false), asked, false).next).toBe("turn"); // the same view is not another face
  });

  it("does not re-read the face it just read while the person is still turning the item", () => {
    const asked = afterRead(WATCH_START, turnStep());
    const first = watchStep(t(true, true), asked, true);
    expect(first.next).toBe("turn");
    const second = watchStep(t(true, true), first.state, true);
    expect(second.next).toBe("turn");
    expect(watchStep(t(true, true), second.state, true).next).toBe("read"); // two checks have passed
    const other = watchStep(t(true, false), asked, true).state; // the laptop saw a face with no date
    expect(watchStep(t(true, true), other, true).next).toBe("read");
  });

  it("front first: the laptop says turn itself, and the next date face is read at once", () => {
    const asked = afterRead(WATCH_START, turnStep(), true);
    expect(watchStep(t(true, true), asked, true).next).toBe("read");
  });

  it("an item put away half-turned takes its turn with it, so the next item starts fresh", () => {
    const asked = afterRead(WATCH_START, turnStep("name"));
    const gone = watchStep(t(false, false), watchStep(t(false, false), asked, true).state, true).state;
    expect(gone.pending).toBeNull();
    expect(gone.ready).toBe(true);
  });

  it("a failed read or a cloud 'nothing there' does not mark the item done", () => {
    expect(afterRead(WATCH_START, null).ready).toBe(true);
    expect(afterRead(WATCH_START, { kind: "no_item", reads: [], route: "" }).ready).toBe(true);
    expect(watchStep(t(true, true), WATCH_START, false).next).toBe("again"); // the same view is not sent again
  });

  it("counts the looks that did not settle an item, so the third one decides", () => {
    let s = afterRead(WATCH_START, turnStep());
    expect(s.tries).toBe(0);
    s = afterRead(s, turnStep());
    s = afterRead(s, turnStep());
    expect(s.tries).toBe(2);
  });
});

describe("hands-free second looks leave an unsettled item waiting", () => {
  const first = [{ read: { product: "", brand: "", category: "unclear", date_text: "2027 FE 14", date_kind: "best_before", damage: "none", confidence: "high", next_action: "log", why: "" }, source: "in_cloud", ms: 900, mode: "only_in_cloud", valid: true }] as never;

  it("keeps waiting for the name when the look shows the date side again", async () => {
    const { m } = models([], [{ text: read({ product: "", brand: "", category: "unclear" }), source: "in_cloud" }]);
    const step = await processItem(m, "img", { today: TODAY, previous: first, watching: true, want: "name" });
    expect(step.kind).toBe("need_date_photo");
    expect(step.kind === "need_date_photo" && step.want).toBe("name");
  });

  it("settles when the front gives the name and chart row", async () => {
    const { m } = models([], [{ text: read({ date_text: "", date_kind: "none_visible", next_action: "show_me_the_date" }), source: "in_cloud" }]);
    const step = await processItem(m, "img", { today: TODAY, previous: first, watching: true, want: "name" });
    expect(step.kind === "verdict" && step.verdict.decision).toBe("KEEP");
  });

  it("a person pressing Read item a second time still gets a decision", async () => {
    const { m } = models([], [{ text: read({ product: "", brand: "", category: "unclear" }), source: "in_cloud" }]);
    const step = await processItem(m, "img", { today: TODAY, previous: first });
    expect(step.kind === "verdict" && step.verdict.decision).toBe("SET_ASIDE");
  });
});

describe("while the laptop's check is still warming up", () => {
  it("the read goes to the cloud, never to the laptop's own full read", async () => {
    const { m, h, c } = models([{ text: read({ next_action: "set_aside", why: "guess" }), source: "on_device" }], [{ text: read({ date_text: "", date_kind: "none_visible", next_action: "show_me_the_date" }), source: "in_cloud" }]);
    m.triage = null; // not warm yet
    m.readInCloud = true;
    const step = await processItem(m, "img", { today: TODAY });
    expect(step.kind).toBe("need_date_photo");
    expect(h.calls).toBe(0);
    expect(c!.calls).toBe(1);
  });
});
