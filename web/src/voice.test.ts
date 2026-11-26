import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { allLines, asideLine, keepLine, KEEP_YEARS } from "./voice";

const DIR = join(__dirname, "../public/voice");

describe("the voice: every line the app can say has a recording of the same words", () => {
  const lines = allLines();
  const list = JSON.parse(readFileSync(join(DIR, "lines.json"), "utf8")) as { lines: Record<string, string> };

  it("has one recording for each line, and no recording of anything else", () => {
    const files = readdirSync(DIR)
      .filter((f) => f.endsWith(".mp3"))
      .map((f) => f.slice(0, -4))
      .sort();
    expect(files).toEqual(Object.keys(lines).sort());
    for (const key of files) expect(statSync(join(DIR, `${key}.mp3`)).size, key).toBeGreaterThan(2000);
  });

  it("recorded the words the source has now", () => {
    expect(list.lines).toEqual(lines);
  });

  it("covers every keep-until month in its years, and says keep alone outside them", () => {
    for (let y = KEEP_YEARS.from; y <= KEEP_YEARS.to; y++) {
      for (let m = 1; m <= 12; m++) {
        const line = keepLine(`${y}-${String(m).padStart(2, "0")}-15`);
        expect(existsSync(join(DIR, `${line.key}.mp3`)), line.key).toBe(true);
      }
    }
    expect(keepLine("2027-05").words).toBe("Keep. Until May 2027.");
    expect(keepLine(`${KEEP_YEARS.to + 1}-01-01`).key).toBe("keep");
    expect(keepLine(undefined).key).toBe("keep");
  });

  it("never says a set-aside reason it has no recording of", () => {
    expect(asideLine("Anything the model wrote.")).toEqual({ key: "aside", words: "Set aside for the lead." });
  });
});
