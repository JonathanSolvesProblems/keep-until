import { beforeEach, describe, expect, it, vi } from "vitest";

// Google sign-in and the Sheets API are replaced with fakes: these tests check what the app
// sends and when, offline, without a Google account.
vi.mock("./firebase", () => ({ auth: { currentUser: { isAnonymous: true, uid: "anon-1" } } }));
vi.mock("firebase/auth", () => {
  class GoogleAuthProvider {
    scopes: string[] = [];
    addScope(s: string) {
      this.scopes.push(s);
    }
    static credentialFromResult() {
      return { accessToken: "fake-token" };
    }
  }
  return {
    GoogleAuthProvider,
    linkWithPopup: vi.fn(async (_u: unknown, p: GoogleAuthProvider) => ({ user: { uid: "anon-1" }, scopes: p.scopes })),
    signInWithPopup: vi.fn(),
  };
});

type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];
let failNext = false;

beforeEach(() => {
  calls = [];
  failNext = false;
  const mem = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
  });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("window", { addEventListener() {} });
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, method: String(init.method), body: init.body ? JSON.parse(String(init.body)) : null });
    if (failNext) {
      failNext = false;
      return { ok: false, status: 503, text: async () => "unavailable", json: async () => ({}) };
    }
    return { ok: true, status: 200, text: async () => "", json: async () => ({ spreadsheetId: "sheet-1" }) };
  });
  vi.resetModules();
});

describe("the food bank's sheet", () => {
  it("asks Google only for files the app creates, then makes the sheet with a header row", async () => {
    const { connectSheet, sheetUrl } = await import("./sheet");
    const { linkWithPopup } = await import("firebase/auth");
    const r = await connectSheet("Demo food bank");
    const provider = (linkWithPopup as unknown as { mock: { calls: [unknown, { scopes: string[] }][] } }).mock.calls[0][1];
    expect(provider.scopes).toEqual(["https://www.googleapis.com/auth/drive.file"]);
    expect(r.uid).toBe("anon-1");
    expect(calls[0].method).toBe("POST");
    expect((calls[0].body as { properties: { title: string } }).properties.title).toBe("Keep Until stock: Demo food bank");
    expect(calls[1].url).toContain("/sheet-1/values/");
    expect((calls[1].body as { values: string[][] }).values[0][0]).toBe("Logged at");
    expect(sheetUrl()).toBe("https://docs.google.com/spreadsheets/d/sheet-1/edit");
  });

  it("appends a logged item as one row", async () => {
    const { connectSheet, appendRow } = await import("./sheet");
    await connectSheet("Demo food bank");
    calls = [];
    const waiting = await appendRow(["2026-11-15", "Chicken broth"]);
    expect(waiting).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(":append");
    expect((calls[0].body as { values: string[][] }).values).toEqual([["2026-11-15", "Chicken broth"]]);
  });

  it("keeps rows on the laptop while offline and sends them in order when back online", async () => {
    const { connectSheet, appendRow, flush, pendingRows } = await import("./sheet");
    await connectSheet("Demo food bank");
    calls = [];
    (navigator as { onLine: boolean }).onLine = false;
    expect(await appendRow(["first"])).toBe(1);
    expect(await appendRow(["second"])).toBe(2);
    expect(calls).toHaveLength(0);
    (navigator as { onLine: boolean }).onLine = true;
    expect(await flush()).toBe(0);
    expect((calls[0].body as { values: string[][] }).values).toEqual([["first"], ["second"]]);
    expect(pendingRows()).toBe(0);
  });

  it("does not lose a row when Google refuses the append", async () => {
    const { connectSheet, appendRow, pendingRows } = await import("./sheet");
    await connectSheet("Demo food bank");
    failNext = true;
    expect(await appendRow(["kept"])).toBe(1);
    expect(pendingRows()).toBe(1);
    expect(await appendRow(["next"])).toBe(0);
    expect((calls[calls.length - 1].body as { values: string[][] }).values).toEqual([["kept"], ["next"]]);
  });
});
