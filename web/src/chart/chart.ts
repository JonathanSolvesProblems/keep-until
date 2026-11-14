// The chart gate. The model reads the package; this code, not the model, decides what the
// Food Banks Canada chart says about it. Every decision carries the chart row and page so
// a sort lead can check it against the printed guideline.

import chartData from "../../../shared/fbc-shelf-life-2018.json";
import type { ParsedDate } from "./dates";

export type Rule = "months" | "days" | "never_past_expiry" | "indefinite" | "no_value" | "set_aside";

export interface ChartRow {
  id: string;
  label: string;
  examples: string;
  page: number;
  rule: Rule;
  min?: number;
  max?: number;
  note?: string;
}

export const CHART = chartData as { source: string; source_url: string; categories: ChartRow[] };
export const CATEGORY_IDS = CHART.categories.map((c) => c.id);

export function chartRow(id: string): ChartRow | undefined {
  return CHART.categories.find((c) => c.id === id);
}

export type DateKind = "best_before" | "expiry" | "packaged_on" | "none_visible";
export type Damage = "none" | "dent" | "bulge" | "rust" | "leak" | "open" | "unsure";

/** A food bank's own policy over the chart, delivered through Remote Config. */
export interface Policy {
  /** Which end of the chart's printed range to use. The default is the cautious one. */
  bound: "min" | "max";
  /** Per-category limits that replace the chart's, e.g. a food bank that shares canned goods to 18 months. */
  overrides?: Record<string, { rule: "months" | "days"; value: number }>;
}

export const DEFAULT_POLICY: Policy = { bound: "min" };

export type Decision = "KEEP" | "DISCARD" | "SET_ASIDE";

export interface Verdict {
  decision: Decision;
  /** Last day the item can go out, when the chart gives one. */
  keepUntil?: string;
  /** True when the printed best-before date is already behind us: the item a "past the date, bin it" sort throws out. */
  pastPrintedDate: boolean;
  reason: string;
  chart?: { id: string; label: string; page: number };
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function limitFor(row: ChartRow, policy: Policy): { rule: "months" | "days"; value: number; from: string } | undefined {
  const o = policy.overrides?.[row.id];
  if (o) return { ...o, from: "food bank policy" };
  if (row.rule !== "months" && row.rule !== "days") return undefined;
  const value = policy.bound === "max" ? row.max! : row.min!;
  return { rule: row.rule, value, from: `chart p.${row.page}` };
}

function verdictForDate(row: ChartRow, iso: string, kind: DateKind, today: string, policy: Policy): Verdict {
  const chart = { id: row.id, label: row.label, page: row.page };
  const pastPrintedDate = today > iso;

  if (row.rule === "never_past_expiry") {
    return today <= iso
      ? { decision: "KEEP", keepUntil: iso, pastPrintedDate, chart, reason: `expiry-dated product, good until the printed date (chart p.${row.page})` }
      : { decision: "DISCARD", keepUntil: iso, pastPrintedDate, chart, reason: `expiry-dated product past its date; never shared past expiry (chart p.${row.page})` };
  }
  if (kind === "packaged_on") {
    return { decision: "SET_ASIDE", pastPrintedDate: false, chart, reason: "packaged-on date: the chart counts from best-before dates, so the lead decides" };
  }
  const limit = limitFor(row, policy)!;
  const keepUntil = limit.rule === "months" ? addMonths(iso, limit.value) : addDays(iso, limit.value);
  const span = `${limit.value} ${limit.rule} past best before (${limit.from})`;
  return today <= keepUntil
    ? { decision: "KEEP", keepUntil, pastPrintedDate, chart, reason: `${row.label}: ${span}` }
    : { decision: "DISCARD", keepUntil, pastPrintedDate, chart, reason: `${row.label}: more than ${span}` };
}

export interface GateInput {
  categoryId: string;
  date: ParsedDate | null;
  dateKind: DateKind;
  damage: Damage;
  today: string;
  policy?: Policy;
}

export function gate(input: GateInput): Verdict {
  const policy = input.policy ?? DEFAULT_POLICY;
  const row = chartRow(input.categoryId);
  if (!row) return { decision: "SET_ASIDE", pastPrintedDate: false, reason: `unknown category "${input.categoryId}"` };
  const chart = { id: row.id, label: row.label, page: row.page };

  if (row.rule === "set_aside") {
    return { decision: "SET_ASIDE", pastPrintedDate: false, chart, reason: row.note ?? `${row.label}: needs a cold-chain or quality check by the lead` };
  }
  if (input.damage !== "none") {
    return {
      decision: "SET_ASIDE",
      pastPrintedDate: false,
      chart,
      reason: `packaging (${input.damage}) goes to the lead: the chart says to assess packaging integrity under Food Banks Canada's Safe Food Handling Standards (p.3)`,
    };
  }
  if (row.rule === "indefinite") {
    return { decision: "KEEP", pastPrintedDate: false, chart, reason: `${row.label}: no limit in the chart (p.${row.page})` };
  }
  if (row.rule === "no_value") {
    return { decision: "SET_ASIDE", pastPrintedDate: false, chart, reason: `${row.label}: the chart prints no room-temperature value (p.${row.page})` };
  }

  const d = input.date;
  if (!d || input.dateKind === "none_visible" || d.kind === "unreadable") {
    return {
      decision: "SET_ASIDE",
      pastPrintedDate: false,
      chart,
      reason: row.note ? `no readable date; ${row.note}` : "no readable date, so the chart cannot be applied",
    };
  }
  if (d.kind === "exact") return verdictForDate(row, d.iso, input.dateKind, input.today, policy);

  // Ambiguous: decide only if every reading of the stamp leads to the same call.
  const verdicts = d.candidates.map((iso) => verdictForDate(row, iso, input.dateKind, input.today, policy));
  const same = verdicts.every((v) => v.decision === verdicts[0].decision);
  if (same) {
    const earliest = verdicts.reduce((a, b) => ((a.keepUntil ?? "") <= (b.keepUntil ?? "") ? a : b));
    return { ...earliest, reason: `${earliest.reason}; the stamp reads ${d.candidates.join(" or ")} and both give the same call` };
  }
  return {
    decision: "SET_ASIDE",
    pastPrintedDate: false,
    chart,
    reason: `the stamp reads ${d.candidates.join(" or ")} (${d.why}) and the two readings disagree`,
  };
}
