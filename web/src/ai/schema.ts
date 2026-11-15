// One JSON Schema for both paths. The on-device model gets it as the Prompt API's
// responseConstraint; the cloud model gets it as responseJsonSchema. Both return the same
// shape, so the gate never needs to know which model read the package.

import { CATEGORY_IDS, CHART } from "../chart/chart";

export const DATE_KINDS = ["best_before", "expiry", "packaged_on", "none_visible"] as const;
export const DAMAGE = ["none", "dent", "bulge", "rust", "leak", "open", "unsure"] as const;
export const CONFIDENCE = ["high", "medium", "low"] as const;

/**
 * The model's own choice of what happens next. This is the branch point of the loop:
 * log it, ask the volunteer to turn the package, hand it to the cloud model, or set it
 * aside for the sort lead.
 */
export const NEXT_ACTIONS = ["log", "show_me_the_date", "ask_cloud", "set_aside", "no_item"] as const;

export type NextAction = (typeof NEXT_ACTIONS)[number];

export interface ItemRead {
  product: string;
  brand: string;
  category: string;
  date_text: string;
  date_kind: (typeof DATE_KINDS)[number];
  damage: (typeof DAMAGE)[number];
  confidence: (typeof CONFIDENCE)[number];
  next_action: NextAction;
  why: string;
}

export const READ_SCHEMA = {
  type: "object",
  properties: {
    // Empty is a legal answer: a can lid or carton top often shows a date and no name, and a
    // required name with no way to say "absent" is how "Broccoli Soup" got logged for a chicken
    // broth carton top (round 1 screenshots, 2026-11-15).
    product: { type: "string", description: "Product name exactly as printed in this photo, e.g. 'Chickpeas 540 mL'. Empty if no name is printed in view; never guess it from the package." },
    brand: { type: "string", description: "Brand as printed, or empty if none is visible." },
    category: { type: "string", enum: [...CATEGORY_IDS, "unclear"], description: "The chart row this product belongs to, or 'unclear' if none fits or you cannot tell." },
    date_text: { type: "string", description: "The date characters exactly as printed, including any BB/MA or EXP prefix. Empty if no date is visible." },
    date_kind: { type: "string", enum: [...DATE_KINDS] },
    damage: { type: "string", enum: [...DAMAGE], description: "Visible packaging condition." },
    // Recorded for the results files only. Self-reported confidence is poorly calibrated,
    // so it never routes anything; next_action and the parser's objective checks do.
    confidence: { type: "string", enum: [...CONFIDENCE], description: "How sure you are of the date characters." },
    next_action: { type: "string", enum: [...NEXT_ACTIONS] },
    why: { type: "string", description: "One short sentence explaining next_action." },
  },
  required: ["product", "brand", "category", "date_text", "date_kind", "damage", "confidence", "next_action", "why"],
} as const;

/**
 * The on-device job, chosen by measurement (results/ondevice-experiment-2026-11-15.md): on
 * real Gemini Nano the full read handled 4 of 15 photos, triage 10 of 15. So the laptop
 * decides only whether a photo is worth a cloud call; the cloud reads the date.
 */
export const TRIAGE_SCHEMA = {
  type: "object",
  properties: {
    package_in_view: { type: "boolean", description: "A food or grocery package is in the photo." },
    date_in_view: { type: "boolean", description: "Printed or stamped date characters are visible in this photo." },
    needs_refrigeration: { type: "boolean", description: "The product is kept in a fridge or freezer (yogurt, cheese, milk, meat, frozen food)." },
    product: { type: "string", description: "Product name exactly as printed in this photo, or empty if none is in view." },
  },
  required: ["package_in_view", "date_in_view", "needs_refrigeration", "product"],
} as const;

export interface Triage {
  package_in_view: boolean;
  date_in_view: boolean;
  needs_refrigeration: boolean;
  product: string;
}

export const TRIAGE_PROMPT =
  "Look at this photo from a food bank sort table. Answer only what you can see. " +
  "package_in_view: is a food or grocery package in the photo? " +
  "date_in_view: can you see printed or stamped date characters (a best before or expiry date)? Nutrition panels, barcodes and lot codes are not dates. " +
  "needs_refrigeration: is this a product kept in a fridge or freezer? " +
  "product: the product name as printed, or empty if no name is in view.";

const CATEGORY_LINES = CHART.categories.map((c) => `${c.id}: ${c.label} (e.g. ${c.examples})`).join("\n");

export function readPrompt(context: { barcodeProduct?: string; secondLook?: boolean } = {}): string {
  return [
    "You are reading one donated food item held up to a camera at a food bank sort table in Canada.",
    "Read only what is printed on the package. Never invent a date.",
    "",
    // No concrete example date here: the on-device model copied one into its answers for
    // packages that carry no such date (devpost/build-log.md, 2026-11-15).
    "Canadian date stamps put the year first, then a two-letter bilingual month code, then the day.",
    "Month codes: JA FE MR AL MA JN JL AU SE OC NO DE.",
    "'BB/MA' means best before. 'EXP' means expiry (infant formula, Ensure, Boost and other meal replacements).",
    "Copy the date characters exactly into date_text; do not convert them. Lot codes are not dates.",
    "",
    "Choose next_action:",
    "- log: you can tell which category the product is and read the full date (or the product has no date by design, like vinegar or honey).",
    "- show_me_the_date: no date is in view (for a can it is usually on the top or bottom). The volunteer will turn the item.",
    "- ask_cloud: a date is visible but you cannot read every character, the label is in a language you cannot read, or the product is unfamiliar.",
    "- set_aside: the package is dented, bulging, rusted, leaking or open, or it needs refrigeration.",
    "- no_item: there is no food package in view at all (an empty table, a wall, a hand with nothing in it).",
    context.secondLook
      ? "This is the second photo of the same item, taken after you asked to see the date."
      : "",
    context.barcodeProduct ? `The barcode lookup says this product is: ${context.barcodeProduct}` : "",
    "",
    "Pick category from this list of Food Banks Canada chart rows (id: label):",
    CATEGORY_LINES,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
