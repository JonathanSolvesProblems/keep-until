// Everything the app can say aloud, word for word. Each line is a recording in public/voice/,
// made once by scripts/make_voice.mjs, so nothing is synthesized while the app runs: no text
// leaves the laptop to be spoken, a shift costs nothing in speech, and a sentence that is not on
// this list cannot be said in this voice. web/src/voice.test.ts fails when a line here has no
// recording of the same words.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Keep-until months that have a recording. A date outside them is spoken as "Keep." alone. */
export const KEEP_YEARS = { from: 2026, to: 2034 };

export const FIXED_LINES = {
  "turn-date": "Turn it, so the date faces the camera.",
  "turn-name": "Turn it, so the name faces the camera.",
  keep: "Keep.",
  discard: "Discard. Two reads agreed it is past its keep-until date.",
  aside: "Set aside for the lead.",
  "aside-fridge": "Set aside for the lead. Needs the fridge. The lead checks the cold chain.",
  "aside-dented": "Set aside for the lead. The package is dented. The lead decides.",
  "aside-bulging": "Set aside for the lead. The package is bulging. The lead decides.",
  "aside-rusted": "Set aside for the lead. The package is rusted. The lead decides.",
  "aside-leaking": "Set aside for the lead. The package is leaking. The lead decides.",
  "aside-open": "Set aside for the lead. The package is open. The lead decides.",
  "aside-no-date": "Set aside for the lead. No date could be read, so the chart cannot be applied.",
  "aside-unclear": "Set aside for the lead. The date stamp could not be read clearly.",
  "aside-no-row": "Set aside for the lead. No row of the chart fits what the photos show.",
  "plug-in": "Plug the laptop in for hands-free. Until then, press Read item.",
  "hands-free-off": "Hands-free is off. Press Read item.",
} as const;

export interface Spoken {
  /** The recording: public/voice/<key>.mp3. */
  key: string;
  /** What the recording says. */
  words: string;
}

export function fixedLine(key: keyof typeof FIXED_LINES): Spoken {
  return { key, words: FIXED_LINES[key] };
}

/** "Keep. Until February 2029." The month and year are said; the day is on the screen. */
export function keepLine(iso: string | undefined): Spoken {
  const [y, m] = (iso ?? "").split("-").map(Number);
  if (!y || !m || m > 12 || y < KEEP_YEARS.from || y > KEEP_YEARS.to) return fixedLine("keep");
  return { key: `keep-${y}-${String(m).padStart(2, "0")}`, words: `Keep. Until ${MONTHS[m - 1]} ${y}.` };
}

/** The recorded set-aside line that says exactly these words, or the short one that gives no reason. */
export function asideLine(reason: string): Spoken {
  const words = `Set aside for the lead. ${reason}`;
  const key = (Object.keys(FIXED_LINES) as (keyof typeof FIXED_LINES)[]).find((k) => FIXED_LINES[k] === words);
  return fixedLine(key ?? "aside");
}

/** Every line, by recording name: what scripts/make_voice.mjs records. */
export function allLines(): Record<string, string> {
  const lines: Record<string, string> = { ...FIXED_LINES };
  for (let y = KEEP_YEARS.from; y <= KEEP_YEARS.to; y++) {
    for (let m = 1; m <= 12; m++) {
      const line = keepLine(`${y}-${String(m).padStart(2, "0")}`);
      lines[line.key] = line.words;
    }
  }
  return lines;
}
