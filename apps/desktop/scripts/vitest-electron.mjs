// Run Vitest inside Electron's Node (ELECTRON_RUN_AS_NODE) so tests use the SAME better-sqlite3
// binary as the app. Usage: node scripts/vitest-electron.mjs [vitest args]
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const electron = require("electron"); // path to the Electron binary
const vitestDir = path.dirname(require.resolve("vitest/package.json"));
const vitest = path.join(vitestDir, "vitest.mjs");

const run = spawnSync(
  electron,
  [vitest, ...(process.argv.slice(2).length ? process.argv.slice(2) : ["run"])],
  {
    stdio: "inherit",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  },
);
process.exit(run.status ?? 1);
