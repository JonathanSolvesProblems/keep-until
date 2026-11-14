// Runs vitest from a working directory whose Windows drive letter is upper case.
// VS Code terminals can start in "c:\..." while Node resolves modules as "C:/...",
// which loads two copies of vitest and fails every suite with
// "Cannot read properties of undefined (reading 'config')".
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const bin = join(cwd, "node_modules", "vitest", "vitest.mjs");
const r = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: "inherit" });
process.exit(r.status ?? 1);
