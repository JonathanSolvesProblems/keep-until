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
    product: { type: "string", description: "Product name as printed, e.g. 'Chickpeas 540 mL'." },
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

const CATEGORY_LINES = CHART.categories.map((c) => `${c.id}: ${c.label} (e.g. ${c.examples})`).join("\n");

export function readPrompt(context: { barcodeProduct?: string; secondLook?: boolean } = {}): string {
  return [
    "You are reading one donated food item held up to a camera at a food bank sort table in Canada.",
    "Read only what is printed on the package. Never invent a date.",
    "",
    "Canadian date stamps put the year first, then a two-letter bilingual month, then the day:",
    "'2026 MR 14' or '26MR14' is March 14, 2026. Months: JA FE MR AL MA JN JL AU SE OC NO DE.",
    "'BB/MA' means best before. 'EXP' means expiry (infant formula, Ensure, Boost and other meal replacements).",
    "Copy the date characters exactly into date_text; do not convert them. Lot codes are not dates.",
    "",
    "Choose next_action:",
    "- log: you can read the product, its category and the full date (or the product has no date by design, like vinegar or honey).",
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
