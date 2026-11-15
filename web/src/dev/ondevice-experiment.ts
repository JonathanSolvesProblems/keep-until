// Dev-only experiment: which job can on-device Gemini Nano do well enough to keep?
// Three narrower on-device tasks over the same sample photos, ONLY_ON_DEVICE, one click.
// Results download as JSON and are graded against results/labels/ by hand-written checks.

import { getGenerativeModel, InferenceMode } from "firebase/ai";
import { ai } from "../firebase";
import { READ_SCHEMA, readPrompt } from "../ai/schema";

export interface Variant {
  id: string;
  schema: object;
  prompt: string;
}

const TRIAGE_SCHEMA = {
  type: "object",
  properties: {
    package_in_view: { type: "boolean", description: "A food or grocery package is in the photo." },
    date_in_view: { type: "boolean", description: "Printed or stamped date characters are visible in this photo." },
    needs_refrigeration: { type: "boolean", description: "The product is kept in a fridge or freezer (yogurt, cheese, milk, meat, frozen food)." },
    product: { type: "string", description: "Product name as printed, or empty." },
  },
  required: ["package_in_view", "date_in_view", "needs_refrigeration", "product"],
};

const DATE_SCHEMA = {
  type: "object",
  properties: {
    date_text: { type: "string", description: "The date characters exactly as printed, or empty if none are visible." },
    date_kind: { type: "string", enum: ["best_before", "expiry", "packaged_on", "none_visible"] },
  },
  required: ["date_text", "date_kind"],
};

export const VARIANTS: Variant[] = [
  { id: "A_full_read_no_example", schema: READ_SCHEMA, prompt: readPrompt() },
  {
    id: "B_triage",
    schema: TRIAGE_SCHEMA,
    prompt:
      "Look at this photo from a food bank sort table. Answer only what you can see. " +
      "package_in_view: is a food or grocery package in the photo? " +
      "date_in_view: can you see printed or stamped date characters (a best before or expiry date)? Nutrition panels, barcodes and lot codes are not dates. " +
      "needs_refrigeration: is this a product kept in a fridge or freezer? " +
      "product: the product name as printed.",
  },
  {
    id: "C_date_only",
    schema: DATE_SCHEMA,
    prompt:
      "Copy the best before or expiry date printed on this package exactly as it appears, character for character. " +
      "Canadian stamps put the year first, then a two-letter month code (JA FE MR AL MA JN JL AU SE OC NO DE), then the day. " +
      "If no date characters are visible, return an empty date_text and none_visible. Never guess.",
  },
];

export async function runExperiment(set: string, files: string[], onProgress: (s: string) => void) {
  const out: { variant: string; file: string; ms: number; source: string; text: string; error?: string }[] = [];
  for (const v of VARIANTS) {
    const model = getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: "image" }, { type: "text", languages: ["en"] }],
          expectedOutputs: [{ type: "text", languages: ["en"] }],
        },
        promptOptions: { responseConstraint: v.schema },
      },
      inCloudParams: { model: "gemini-3.5-flash-lite" },
    });
    await model.initializeDeviceModel();
    for (const [i, file] of files.entries()) {
      onProgress(`on-device experiment · ${v.id} · ${i + 1}/${files.length}`);
      const img = new Image();
      img.src = `/testset/${set}/${file}`;
      await img.decode();
      const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      const b64 = c.toDataURL("image/jpeg", 0.88).split(",")[1];
      const t0 = performance.now();
      try {
        const r = await model.generateContent([
          { type: "inlineData", inlineData: { mimeType: "image/jpeg", data: b64 } },
          { type: "text", text: v.prompt },
        ]);
        out.push({ variant: v.id, file, ms: Math.round(performance.now() - t0), source: String(r.response.inferenceSource), text: r.response.text() });
      } catch (e) {
        out.push({ variant: v.id, file, ms: Math.round(performance.now() - t0), source: "error", text: "", error: (e as Error).message });
      }
    }
  }
  return out;
}
