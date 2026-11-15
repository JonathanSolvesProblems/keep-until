// What the volunteer sees: the printed answer, the shift record and the read-by badge, in
// plain words (charter law 14: internal strings never reach the screen).

import type { Step } from "./ai/loop";
import type { ReadResult } from "./ai/reader";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return d ? `${d} ${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${y}`;
}

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Upper case, the way a date coder prints it.
  return `${d ? d + " " : ""}${MONTHS[m - 1].slice(0, 3).toUpperCase()} ${y}`;
}

// Icons are dot-matrix pictograms on a 7 by 7 grid (charter law 9).
const ICONS: Record<string, string[]> = {
  laptop: [".......", ".#####.", ".#...#.", ".#...#.", ".#####.", "#######", "......."],
  cloud: [".......", "..##...", ".####.#", "#######", "#######", ".#####.", "......."],
};

export function dotIcon(name: keyof typeof ICONS, label: string): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 7 7");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  ICONS[name].forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== "#") return;
      const dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", String(x + 0.5));
      dot.setAttribute("cy", String(y + 0.5));
      dot.setAttribute("r", "0.42");
      dot.setAttribute("fill", "currentColor");
      svg.append(dot);
    }),
  );
  return svg;
}

export function readBy(reads: ReadResult[]): { lead: string; rest: string; icons: ("laptop" | "cloud")[]; seconds: string } {
  const device = reads.some((r) => r.source === "on_device");
  const cloud = reads.some((r) => r.source === "in_cloud");
  const seconds = (reads.reduce((s, r) => s + r.ms, 0) / 1000).toFixed(1) + " s";
  const cloudReads = reads.filter((r) => r.source === "in_cloud").length;
  const where = cloudReads > 1 ? "read twice in the cloud" : "read in the cloud";
  if (device && cloud) return { lead: "Checked on this laptop", rest: `, date ${where}`, icons: ["laptop", "cloud"], seconds };
  if (device) return { lead: reads.length > 1 ? "Read twice on this laptop" : "Read on this laptop", rest: "", icons: ["laptop"], seconds };
  return { lead: where.charAt(0).toUpperCase() + where.slice(1), rest: "", icons: ["cloud"], seconds };
}

/** Turns the gate's and the loop's reasons into the sort lead's words. */
export function plainReason(text: string): { reason: string; source?: string } {
  let t = text.trim();
  let source: string | undefined;
  const chart = t.match(/\s*\(chart p\.(\d+)\)/);
  if (chart) {
    source = `Food Banks Canada chart, page ${chart[1]}`;
    t = t.replace(chart[0], "");
  }
  if (/\(food bank policy\)/.test(t)) {
    source = "This food bank's own policy";
    t = t.replace(/\s*\(food bank policy\)/, "");
  }
  t = t
    .replace(/^the cloud model could not settle it: /i, "")
    .replace(/^cloud read did not settle it: /i, "")
    .replace(/^on-device could not settle it and the cloud is off: /i, "This laptop could not settle it, and cloud reads are off: ")
    .replace(/date "[^"]*" does not parse \([^)]*\)/i, "the date stamp could not be read clearly")
    .replace(/^no readable date, so the chart cannot be applied$/i, "No date could be read, so the chart cannot be applied")
    .replace(/(\d{4}-\d{2}-\d{2})/g, (iso) => longDate(iso));
  const keep = t.match(/^(.*?): (\d+ (?:months|days)) past best before$/);
  if (keep) t = `${keep[1]} keep ${keep[2]} past best before.`;
  const over = t.match(/^(.*?): more than (\d+ (?:months|days)) past best before$/);
  if (over) t = `${over[1]} keep ${over[2]} past best before, and this one is older than that.`;
  if (/^expiry-dated product, good until/i.test(t)) t = "Good until its expiry date. Formula and meal replacements never go out after it.";
  if (/^expiry-dated product past its date/i.test(t)) t = "Past its expiry date. Formula and meal replacements never go out after it.";
  t = t.replace(/(?<!\d)1 (month|day)s\b/g, "1 $1");
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.?!]$/.test(t)) t += ".";
  return { reason: t, source };
}

interface View {
  cls: "KEEP" | "SET_ASIDE" | "DISCARD" | "TURN" | "NONE";
  word: string;
  until?: string;
  reason: string;
  source?: string;
  stamp?: { code: string; plain: string };
  /** The second line under the word, when there is no keep-until date ("for the lead"). */
  sub?: string;
}

function stampOf(step: Step): View["stamp"] {
  if (step.kind !== "verdict" || step.parsed?.kind !== "exact") return undefined;
  const read = [...step.reads].reverse().find((r) => r.read.date_text);
  if (!read) return undefined;
  const kind = read.read.date_kind === "expiry" ? "Expiry" : read.read.date_kind === "packaged_on" ? "Packaged on" : "Best before";
  // Only the date itself is re-printed: a lot code on the same line ("2027 FE 14 02146") is not.
  const raw = read.read.date_text.replace(/^(BB\/MA|BEST BEFORE|MEILLEUR AVANT|EXP)\s*/i, "");
  const code = raw.match(/\d{2,4}\s?[A-Z]{2}\s?\d{1,2}(?!\d)/i)?.[0] ?? raw;
  return { code: code.toUpperCase(), plain: `${kind} ${longDate(step.parsed.iso)}` };
}

export function viewOf(step: Step): View {
  if (step.kind === "no_item")
    return {
      cls: "NONE",
      word: "Nothing in view",
      reason: "Hold the item closer, date side toward the camera.",
    };
  if (step.kind === "need_date_photo")
    return {
      cls: "TURN",
      word: "Turn it",
      sub: "so the date faces the camera",
      reason: "Show the side with the date stamp, then press Read item again.",
    };
  const { reason, source } = plainReason(step.verdict.reason);
  const stamp = stampOf(step);
  if (step.verdict.decision === "KEEP") return { cls: "KEEP", word: "Keep", until: step.verdict.keepUntil, reason, source, stamp };
  if (step.verdict.decision === "DISCARD") {
    // A discard only happens after a second read agreed on the date (loop.ts confirmDiscard).
    const agreed = step.reads.length > 1 ? " Two reads agreed on the date." : "";
    return { cls: "DISCARD", word: "Discard", reason: reason + agreed, source, stamp };
  }
  return {
    cls: "SET_ASIDE",
    word: "Set aside",
    sub: "for the lead",
    reason,
    source,
    stamp,
  };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function renderAnswer(container: HTMLElement, step: Step): void {
  const v = viewOf(step);
  const root = el("div", `verdict verdict--${v.cls}`);
  // The decision first and largest, then the stamp it was read from (charter law 3).
  const band = el("div", "band");
  band.append(el("p", "band-word", v.word));
  if (v.until) {
    const until = el("p", "band-until", "until ");
    until.append(el("span", "date", shortDate(v.until)));
    band.append(until);
  } else if (v.sub) {
    band.append(el("p", "band-until", v.sub));
  }
  root.append(band);
  if (v.stamp) {
    const stamp = el("div", "stamp");
    const code = el("span", "stamp-code", v.stamp.code);
    code.setAttribute("aria-label", `Stamped on the package: ${v.stamp.code}`);
    stamp.append(code, el("span", "stamp-plain", v.stamp.plain));
    root.append(stamp);
  }
  const reason = el("p", "reason", v.reason);
  if (v.source) reason.append(el("span", "reason-source", v.source));
  root.append(reason);
  if (step.reads.length) {
    const rb = readBy(step.reads);
    const badge = el("p", "readby");
    rb.icons.forEach((i) => badge.append(dotIcon(i, i === "laptop" ? "this laptop" : "the cloud")));
    const words = el("span");
    words.append(el("strong", "", rb.lead), `${rb.rest} in ${rb.seconds}`);
    badge.append(words);
    root.append(badge);
  }
  container.replaceChildren(root);
}

export function renderRow(step: Step, thumb: string): HTMLLIElement | null {
  if (step.kind !== "verdict") return null;
  const v = viewOf(step);
  const last = step.reads[step.reads.length - 1]?.read;
  const li = el("li", `row verdict--${v.cls}`);
  const img = el("img");
  img.src = thumb;
  img.alt = "";
  const chip = el("span", "row-verdict", v.word);
  const what = el("div", "row-what");
  // The read often repeats the brand inside the product name ("Liberté Liberté Grec").
  const brand = last?.brand?.trim() ?? "";
  const product = last?.product?.trim() ?? "";
  const name = brand && product.toLowerCase().startsWith(brand.toLowerCase()) ? product : [brand, product].filter(Boolean).join(" ");
  // With no name printed in view, the chart row the gate used names the item, and says so.
  const row = step.verdict.chart?.label;
  what.append(el("strong", "", name || row || "Item with no name in view"));
  const detail = v.stamp ? v.stamp.plain : v.reason;
  what.append(el("span", "", name || !row ? detail : `No name in this photo. ${detail}`));
  // One meaning for the right-hand column: the date it stays good until, when it is kept.
  const until = el("div", "row-until");
  if (v.until) {
    until.append("keep until");
    until.append(el("span", "date", shortDate(v.until)));
  }
  li.append(img, chip, what, until);
  return li;
}

export function renderTally(container: HTMLElement, steps: Step[]): void {
  const verdicts = steps.filter((s): s is Extract<Step, { kind: "verdict" }> => s.kind === "verdict");
  if (!verdicts.length) {
    container.replaceChildren();
    return;
  }
  const count = (d: string) => verdicts.filter((s) => s.verdict.decision === d).length;
  const parts: [number, string][] = [
    [verdicts.length, verdicts.length === 1 ? "item" : "items"],
    [count("KEEP"), "kept"],
    [count("SET_ASIDE"), "set aside"],
    [count("DISCARD"), "discarded"],
  ];
  // "3 items: 1 kept, 1 set aside, 1 discarded"
  container.replaceChildren(
    ...parts.flatMap(([n, word], i) => {
      const nodes: (Node | string)[] = [];
      if (i) nodes.push(i === 1 ? ": " : ", ");
      nodes.push(el("span", "n", String(n)), ` ${word}`);
      return nodes;
    }),
  );
}
