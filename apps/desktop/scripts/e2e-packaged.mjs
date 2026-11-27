// Runs the Playwright specs against the PACKAGED e2e flavour (run `pnpm package:e2e` first; the
// release build refuses Playwright, spec 018 O15). Finds the unpacked executable under release-e2e/ and passes it to
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
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  DESKTOP_FOLDER,
  PACKAGE_FLAVOURS,
  findPackagedExecutable,
} from "./packagedApp/packagedApp.mjs";

const desktopFolder = DESKTOP_FOLDER;
const say = (text) => process.stdout.write(`${text}\n`);
const fail = (text) => process.stderr.write(`${text}\n`);
const OFFLINE_FLAG = "--offline";
const DENY_NETWORK_PROFILE =
  '(version 1)(allow default)(deny network*)(allow network* (remote ip "localhost:*"))(allow network* (local ip "localhost:*"))';

/** A tiny launcher that runs the app inside a sandbox profile that denies the network. */
function writeOfflineLauncher(executable) {
  const launcherFolder = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-offline-"));
  const launcher = path.join(launcherFolder, "shopos-offline.sh");
  const script = `#!/bin/sh\nexec /usr/bin/sandbox-exec -p '${DENY_NETWORK_PROFILE}' "${executable}" "$@"\n`;
  fs.writeFileSync(launcher, script, { mode: 0o755 });
  return launcher;
}

const executable = findPackagedExecutable(PACKAGE_FLAVOURS.e2e);
if (!executable) {
  fail("No e2e package under apps/desktop/release-e2e. Run `pnpm package:e2e` first.");
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

const result = spawnSync("pnpm", ["exec", "playwright", "test", ...playwrightArguments], {
  cwd: desktopFolder,
  stdio: "inherit",
  env: {
    ...process.env,
    SHOPOS_E2E_EXECUTABLE: launchedExecutable,
    ...(isOffline ? { SHOPOS_E2E_NO_SANDBOX: "1" } : {}),
  },
});
process.exit(result.status ?? 1);
