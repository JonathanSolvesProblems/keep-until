// Parses the date text a model read off a package into calendar dates.
//
// Canadian rules (CFIA, "Date markings and storage instructions", read 2026-11-14):
// the year comes first and may be left out when the date is clear, then the month as a
// bilingual symbol, then the day: "17 JN 28" is 2017-06-28, "JN 28" has no year.
// Symbols: JA FE MR AL MA JN JL AU SE OC NO DE. "MA" is May, and it is also the second
// half of the "BB/MA" (best before / meilleur avant) prefix, so the prefix is stripped
// with care. Imported products use other orders, which is where ambiguity comes from.
//
// The parser never guesses between two readings. It returns every plausible candidate
// and lets the chart gate decide whether the candidates agree.

export type ParsedDate =
  | { kind: "exact"; iso: string; precision: "day" | "month" }
  | { kind: "ambiguous"; candidates: string[]; why: string }
  | { kind: "unreadable"; why: string };

const CFIA_SYMBOLS: Record<string, number> = {
  JA: 1, FE: 2, MR: 3, AL: 4, MA: 5, JN: 6, JL: 7, AU: 8, SE: 9, OC: 10, NO: 11, DE: 12,
};

const MONTH_WORDS: Record<string, number> = {
  JAN: 1, JANUARY: 1, JANV: 1, JANVIER: 1,
  FEB: 2, FEBRUARY: 2, FEV: 2, FEVR: 2, FEVRIER: 2,
  MAR: 3, MARCH: 3, MARS: 3,
  APR: 4, APRIL: 4, AVR: 4, AVRIL: 4,
  MAY: 5, MAI: 5,
  JUN: 6, JUNE: 6, JUIN: 6,
  JUL: 7, JULY: 7, JUIL: 7, JUILLET: 7,
  AUG: 8, AUGUST: 8, AOUT: 8,
  SEP: 9, SEPT: 9, SEPTEMBER: 9, SEPTEMBRE: 9,
  OCT: 10, OCTOBER: 10, OCTOBRE: 10,
  NOV: 11, NOVEMBER: 11, NOVEMBRE: 11,
  DEC: 12, DECEMBER: 12, DECEMBRE: 12,
};

const PREFIX = new RegExp(
  "^(?:" +
    [
      "BEST\\s*BEFORE\\s*/?\\s*MEILLEUR\\s*AVANT",
      "MEILLEUR\\s*AVANT",
      "BEST\\s*BEFORE",
      "BEST\\s*BY",
      "BB\\s*/\\s*MA",
      "BBD",
      "BB",
      "EXPIRY\\s*DATE",
      "EXPIRATION\\s*DATE",
      "DATE\\s*LIMITE\\s*D'UTILISATION",
      "EXPIRY",
      "EXP",
      "USE\\s*BY",
      "PACKAGED\\s*ON\\s*/?\\s*EMPAQUETE\\s*LE",
      "PACKAGED\\s*ON",
      "EMPAQUETE\\s*LE",
    ].join("|") +
    ")[\\s:./-]*",
);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function stripPrefixes(text: string): string {
  let t = text;
  for (let i = 0; i < 4; i++) {
    const next = t.replace(PREFIX, "");
    if (next === t) break;
    t = next.trim();
  }
  return t;
}

function tokenize(text: string): string[] {
  return text.match(/[A-Z]+|\d+/g) ?? [];
}

function monthOf(token: string): number | undefined {
  return CFIA_SYMBOLS[token] ?? MONTH_WORDS[token];
}

function expandYear(token: string): number | undefined {
  if (token.length === 4) return Number(token);
  if (token.length === 2) return 2000 + Number(token);
  return undefined;
}

function isoOf(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return undefined;
  return dt.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function unique(xs: string[]): string[] {
  return [...new Set(xs)].sort();
}

function result(candidates: (string | undefined)[], why: string): ParsedDate {
  const ok = unique(candidates.filter((c): c is string => Boolean(c)));
  if (ok.length === 0) return { kind: "unreadable", why: "no valid calendar date in " + why };
  if (ok.length === 1) return { kind: "exact", iso: ok[0], precision: "day" };
  return { kind: "ambiguous", candidates: ok, why };
}

/**
 * Fills in a missing year. CFIA lets the year be left out only when it is clear, which in
 * practice means short shelf-life products (a durable life of 90 days or less needs a
 * date at all). So a plausible reading sits no more than 180 days behind the sort and no
 * more than 120 days ahead of it. Anything else is left ambiguous or unreadable.
 */
function withoutYear(m: number, d: number, today: string): ParsedDate {
  const y = Number(today.slice(0, 4));
  const lower = addDaysIso(today, -180);
  const upper = addDaysIso(today, 120);
  const plausible = [y - 1, y, y + 1]
    .map((yy) => isoOf(yy, m, d))
    .filter((iso): iso is string => Boolean(iso) && iso! > lower && iso! <= upper);
  return result(plausible, "month and day with no year");
}

/**
 * A misread digit can turn a real stamp into a calendar-valid date centuries away: the cloud
 * read a cut-off "2027" as "5037" on 15 November 2026 and the gate said keep. A best-before or
 * expiry stamp sits within a few years of the day it is sorted, so a year more than 15 behind
 * or 7 ahead of the sort date is refused as unreadable and the item goes to a second look.
 */
const YEARS_BEHIND = 15;
const YEARS_AHEAD = 7;

export function parseDateText(raw: string, today: string): ParsedDate {
  const parsed = parseStamp(raw, today);
  const y = Number(today.slice(0, 4));
  const ok = (iso: string) => {
    const yy = Number(iso.slice(0, 4));
    return yy >= y - YEARS_BEHIND && yy <= y + YEARS_AHEAD;
  };
  if (parsed.kind === "exact" && !ok(parsed.iso)) return { kind: "unreadable", why: `year ${parsed.iso.slice(0, 4)} is not a plausible date stamp` };
  if (parsed.kind === "ambiguous") {
    const kept = parsed.candidates.filter(ok);
    // An ambiguous stamp stays ambiguous (the lead decides); it is never narrowed to one date here.
    if (kept.length === 0) return { kind: "unreadable", why: "no plausible year among " + parsed.candidates.join(", ") };
  }
  return parsed;
}

function parseStamp(raw: string, today: string): ParsedDate {
  const upper = stripAccents(raw).toUpperCase().trim();
  if (!upper) return { kind: "unreadable", why: "empty" };

  let body = stripPrefixes(upper);
  let tokens = tokenize(body);

  // "BB MA 14" can mean best before, May 14. If stripping a bare "BB" left no month at
  // all but the original had a lone "MA", put the MA back as the month.
  if (!tokens.some((t) => monthOf(t) !== undefined) && /\bMA\b/.test(upper)) {
    body = upper.replace(/^(BEST\s*BEFORE|BB)[\s:./-]*/, "");
    tokens = tokenize(body);
  }

  // "BB MA 2026 JA 14": the MA belongs to the prefix when another month follows it.
  if (tokens[0] === "MA" && tokens.slice(1).some((t) => monthOf(t) !== undefined)) {
    tokens = tokens.slice(1);
  }

  const isNum = (t: string | undefined): t is string => t !== undefined && /^\d+$/.test(t);
  const alphaIdx = tokens.findIndex((t) => monthOf(t) !== undefined);

  if (alphaIdx >= 0) {
    const symbol = tokens[alphaIdx];
    const m = monthOf(symbol)!;
    const isCfia = symbol.length === 2;
    // Only the numbers touching the month belong to the date; a lot code elsewhere on
    // the same line ("L2345 26 JA 14") is ignored.
    const before = isNum(tokens[alphaIdx - 1]) ? [tokens[alphaIdx - 1]] : [];
    const after: string[] = [];
    for (let i = alphaIdx + 1; i < tokens.length && after.length < 2 && isNum(tokens[i]); i++) after.push(tokens[i]);
    const nums = [...before, ...after];

    // CFIA order: [year] month day
    if (before.length === 1 && after.length >= 1) {
      const a = before[0];
      const b = after[0];
      if (isCfia) {
        const y = expandYear(a);
        return y ? result([isoOf(y, m, Number(b))], "CFIA year-month-day") : { kind: "unreadable", why: "year token " + a };
      }
      // English or French month word between two numbers.
      if (a.length === 4) return result([isoOf(Number(a), m, Number(b))], "year-month-day");
      if (b.length === 4) return result([isoOf(Number(b), m, Number(a))], "day-month-year");
      const y1 = expandYear(a);
      const y2 = expandYear(b);
      return result(
        [y1 ? isoOf(y1, m, Number(b)) : undefined, y2 ? isoOf(y2, m, Number(a)) : undefined],
        "two-digit numbers on both sides of the month",
      );
    }
    if (before.length === 0 && after.length === 2) {
      // "JAN 14 2026" or "JA 14 26"
      const [d, y] = after;
      const yy = expandYear(y);
      if (yy && Number(d) <= 31) return result([isoOf(yy, m, Number(d))], "month-day-year");
      return { kind: "unreadable", why: "month followed by " + after.join(" ") };
    }
    if (before.length === 0 && after.length === 1) {
      const n = after[0];
      if (n.length === 4) {
        const iso = isoOf(Number(n), m, 1);
        return iso ? { kind: "exact", iso, precision: "month" } : { kind: "unreadable", why: "month and year" };
      }
      // "JN 28": month and day, year omitted (CFIA allows it when clear)
      return withoutYear(m, Number(n), today);
    }
    if (before.length === 1 && after.length === 0) {
      const n = before[0];
      if (n.length === 4) {
        const iso = isoOf(Number(n), m, 1);
        return iso ? { kind: "exact", iso, precision: "month" } : { kind: "unreadable", why: "year and month" };
      }
      return withoutYear(m, Number(n), today);
    }
    return { kind: "unreadable", why: "month with " + nums.length + " numbers around it" };
  }

  // Numbers only. Separated parts are dates; a solid run of digits is usually a lot code.
  const parts = body.split(/[\s./-]+/).filter((p) => /^\d+$/.test(p));
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (a.length === 4) return result([isoOf(Number(a), Number(b), Number(c))], "year-month-day");
    if (c.length === 4 || c.length === 2) {
      const y = expandYear(c)!;
      return result(
        [isoOf(y, Number(b), Number(a)), isoOf(y, Number(a), Number(b))],
        "numeric day and month in an unknown order",
      );
    }
  }
  if (parts.length === 2 && (parts[0].length === 4 || parts[1].length === 4)) {
    const [y, m] = parts[0].length === 4 ? [parts[0], parts[1]] : [parts[1], parts[0]];
    const iso = isoOf(Number(y), Number(m), 1);
    return iso ? { kind: "exact", iso, precision: "month" } : { kind: "unreadable", why: "numeric year and month" };
  }
  return { kind: "unreadable", why: "no month and no separated date parts (likely a lot code)" };
}
