// Make sure better-sqlite3's native binary is the ELECTRON build (one binary for app, tests and e2e).
// If it is not, fetch the matching prebuilt binary. Safe to run repeatedly; ~1 s when already correct.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const say = (text) => process.stdout.write(`${text}\n`);
const fail = (text) => process.stderr.write(`${text}\n`);
const require = createRequire(import.meta.url);
const electron = require("electron");
const electronDir = path.dirname(require.resolve("electron"));
const electronVersion = JSON.parse(
  fs.readFileSync(path.join(electronDir, "package.json"), "utf8"),
).version;
const sqliteDir = path.resolve(path.dirname(require.resolve("better-sqlite3")), "..");

function loadsInElectron() {
  const probe = spawnSync(electron, ["-e", "new (require('better-sqlite3'))(':memory:').close()"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    encoding: "utf8",
  });
  return { ok: probe.status === 0, output: `${probe.stderr ?? ""}${probe.stdout ?? ""}`.trim() };
}

if (!fs.existsSync(electron)) {
  fail(
    `[ensure-electron-sqlite] Electron binary missing at ${electron}. Run: node ${path.join(electronDir, "install.js")}`,
  );
  process.exit(1);
}

let check = loadsInElectron();
if (check.ok) process.exit(0);

say(
  `[ensure-electron-sqlite] better-sqlite3 is not built for Electron ${electronVersion}. Fetching the prebuilt binary...`,
);
const fix = spawnSync(
  "npx",
  ["--yes", "prebuild-install", "-r", "electron", "-t", electronVersion],
  { cwd: sqliteDir, stdio: "inherit" },
);
check = loadsInElectron();
if (fix.status === 0 && check.ok) {
  say("[ensure-electron-sqlite] OK");
  process.exit(0);
}
fail(
  `[ensure-electron-sqlite] Could not make better-sqlite3 load in Electron ${electronVersion}.\n${check.output}\n` +
    `Try manually (needs network): cd ${sqliteDir} && npx prebuild-install -r electron -t ${electronVersion}\n` +
    `or compile from source: npx @electron/rebuild -f -w better-sqlite3`,
);
process.exit(1);
