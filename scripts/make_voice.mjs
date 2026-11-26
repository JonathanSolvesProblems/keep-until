/**
 * Records every line the app can say aloud (web/src/voice.ts) once, with ElevenLabs, and writes
 *
 *   web/public/voice/<key>.mp3
 *   web/public/voice/lines.json     what was recorded, word for word, with the voice and model
 *
 *   node scripts/make_voice.mjs           (needs ELEVENLABS_API_KEY in the shell, or node --env-file=...)
 *   node scripts/make_voice.mjs --all     records every line again, not only the changed ones
 *
 * The app never calls ElevenLabs: it plays these files. A line is recorded again only when its
 * words changed, so a second run costs nothing. web/src/voice.test.ts fails when a line in the
 * source has no recording of the same words. Needs Node 24 (it imports the TypeScript directly).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { allLines } = await import(pathToFileURL(join(root, "web/src/voice.ts")).href);
const LINES = allLines();

const key = process.env.ELEVENLABS_API_KEY ?? "";
if (!key) {
  console.error("No ELEVENLABS_API_KEY in the shell.");
  process.exit(1);
}

const VOICE = { name: "Sarah", id: "EXAVITQu4vr4xnSDxMaL" };
const MODEL = "eleven_flash_v2_5";
const SETTINGS = { stability: 0.5, similarity_boost: 0.75 };
const FORMAT = "mp3_44100_64";

const OUT = join(root, "web/public/voice");
const LIST = join(OUT, "lines.json");
mkdirSync(OUT, { recursive: true });
const before = existsSync(LIST) ? JSON.parse(readFileSync(LIST, "utf8")) : { lines: {} };
const all = process.argv.includes("--all");
const only = process.argv.filter((a) => a.startsWith("--only=")).flatMap((a) => a.slice(7).split(","));
let recorded = 0;
let characters = 0;

for (const [name, text] of Object.entries(LINES)) {
  const file = join(OUT, `${name}.mp3`);
  const again = all || only.includes(name);
  if (!again && before.lines?.[name] === text && existsSync(file)) continue;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE.id}?output_format=${FORMAT}`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
  });
  if (!response.ok) {
    console.error(`${name}: ${response.status} ${(await response.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const audio = Buffer.from(await response.arrayBuffer());
  writeFileSync(file, audio);
  recorded++;
  characters += text.length;
  console.log(`${name}.mp3  ${audio.length} bytes  "${text}"`);
}
// A line taken out of the source takes its recording with it.
for (const name of Object.keys(before.lines ?? {})) {
  if (name in LINES) continue;
  rmSync(join(OUT, `${name}.mp3`), { force: true });
  console.log(`removed ${name}`);
}
writeFileSync(LIST, JSON.stringify({ madeWith: "ElevenLabs", voice: VOICE, model: MODEL, settings: SETTINGS, format: FORMAT, lines: LINES }, null, 1) + "\n");
console.log(`${recorded} recorded (${characters} characters), ${Object.keys(LINES).length - recorded} kept.`);
