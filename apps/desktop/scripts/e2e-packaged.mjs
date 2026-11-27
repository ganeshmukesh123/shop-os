// Runs the Playwright specs against the PACKAGED app (run `pnpm package` first).
// Finds the unpacked executable that electron-builder wrote under release/ and passes it to
// tests/e2e/launch.ts through SHOPOS_E2E_EXECUTABLE.
//
//   pnpm test:e2e:packaged               run the specs against the packaged app
//   pnpm test:e2e:packaged --offline     macOS only: also deny every non-loopback network call to
//                                        the app with sandbox-exec (spec FR-020, task T062). The
//                                        Chromium sandbox is switched off for that run because a
//                                        sandboxed process cannot start another sandbox.
// Any other argument goes to Playwright, for example `pnpm test:e2e:packaged billing.spec.ts`.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const desktopFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseFolder = path.join(desktopFolder, "release");
const say = (text) => process.stdout.write(`${text}\n`);
const fail = (text) => process.stderr.write(`${text}\n`);
const OFFLINE_FLAG = "--offline";
const DENY_NETWORK_PROFILE =
  '(version 1)(allow default)(deny network*)(allow network* (remote ip "localhost:*"))(allow network* (local ip "localhost:*"))';

const CANDIDATE_EXECUTABLES = [
  "mac-arm64/Shop OS.app/Contents/MacOS/Shop OS",
  "mac/Shop OS.app/Contents/MacOS/Shop OS",
  "win-unpacked/Shop OS.exe",
  "linux-unpacked/shop-os",
  "linux-unpacked/@shoposdesktop",
];

function findPackagedExecutable() {
  return CANDIDATE_EXECUTABLES.map((relativePath) => path.join(releaseFolder, relativePath)).find(
    (candidatePath) => fs.existsSync(candidatePath),
  );
}

/** A tiny launcher that runs the app inside a sandbox profile that denies the network. */
function writeOfflineLauncher(executable) {
  const launcherFolder = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-offline-"));
  const launcher = path.join(launcherFolder, "shopos-offline.sh");
  const script = `#!/bin/sh\nexec /usr/bin/sandbox-exec -p '${DENY_NETWORK_PROFILE}' "${executable}" "$@"\n`;
  fs.writeFileSync(launcher, script, { mode: 0o755 });
  return launcher;
}

const executable = findPackagedExecutable();
if (!executable) {
  fail("No packaged app under apps/desktop/release. Run `pnpm package` first.");
  process.exit(1);
}

const isOffline = process.argv.includes(OFFLINE_FLAG);
if (isOffline && process.platform !== "darwin") {
  fail("--offline uses sandbox-exec and only works on macOS.");
  process.exit(1);
}

const playwrightArguments = process.argv.slice(2).filter((argument) => argument !== OFFLINE_FLAG);
const launchedExecutable = isOffline ? writeOfflineLauncher(executable) : executable;
say(`Running the e2e specs against ${executable}${isOffline ? " (network denied)" : ""}`);

// Playwright's own CLI is started with this Node, not through pnpm: on Windows pnpm is a .cmd file
// that needs a shell (found by the smoke test), and a shell splits an argument such as
// `--grep "sign in"` at the space. With no shell, every argument reaches Playwright whole.
const playwrightCli = createRequire(path.join(desktopFolder, "package.json")).resolve(
  "@playwright/test/cli",
);
const result = spawnSync(process.execPath, [playwrightCli, "test", ...playwrightArguments], {
  cwd: desktopFolder,
  stdio: "inherit",
  env: {
    ...process.env,
    SHOPOS_E2E_EXECUTABLE: launchedExecutable,
    ...(isOffline ? { SHOPOS_E2E_NO_SANDBOX: "1" } : {}),
  },
});
if (result.error) fail(`Could not start Playwright: ${result.error.message}`);
process.exit(result.status ?? 1);
