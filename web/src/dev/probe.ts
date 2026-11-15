// Dev-only latency probe for the cloud path. Not imported by the app; a test script loads
// it into the dev server page and times the same image under different model settings.

import { getGenerativeModel, InferenceMode, ThinkingLevel } from "firebase/ai";
import { ai } from "../firebase";
import { READ_SCHEMA, readPrompt } from "../ai/schema";

export interface ProbeConfig {
  label: string;
  model: string;
  thinkingLevel?: string;
}

export const DEFAULT_CONFIGS: ProbeConfig[] = [
  { label: "3.8-flash default thinking", model: "gemini-3.8-flash" },
  { label: "3.8-flash minimal thinking", model: "gemini-3.8-flash", thinkingLevel: ThinkingLevel.MINIMAL },
  { label: "3.5-flash-lite default", model: "gemini-3.5-flash-lite" },
  { label: "3.5-flash-lite minimal thinking", model: "gemini-3.5-flash-lite", thinkingLevel: ThinkingLevel.MINIMAL },
];

export async function probe(jpegBase64: string, configs: ProbeConfig[] = DEFAULT_CONFIGS, rounds = 2) {
  const out: { label: string; round: number; ms: number; ok: boolean; text: string }[] = [];
  for (let round = 1; round <= rounds; round++) {
    for (const c of configs) {
      const model = getGenerativeModel(ai, {
        mode: InferenceMode.ONLY_IN_CLOUD,
        inCloudParams: {
          model: c.model,
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: READ_SCHEMA,
            temperature: 0,
            ...(c.thinkingLevel ? { thinkingConfig: { thinkingLevel: c.thinkingLevel as never } } : {}),
          },
        },
      });
      const t0 = performance.now();
      try {
        const r = await model.generateContent([
          { type: "inlineData", inlineData: { mimeType: "image/jpeg", data: jpegBase64 } },
          { type: "text", text: readPrompt() },
        ]);
        out.push({ label: c.label, round, ms: Math.round(performance.now() - t0), ok: true, text: r.response.text().slice(0, 200) });
      } catch (e) {
        out.push({ label: c.label, round, ms: Math.round(performance.now() - t0), ok: false, text: String((e as Error).message).slice(0, 200) });
      }
    }
  }
  return out;
}
