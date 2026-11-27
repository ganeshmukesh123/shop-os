// Smoke check of the RELEASE build (spec 018 US4: T022, T024, T025). Playwright cannot drive it,
// because its fuses and the start-up switch check refuse the debugger, so this script starts the
// binary directly. Run `pnpm package` first, then `pnpm smoke:release` (or `--app <path>` for
// another build). Needs the sqlite3 CLI.
//
//   1. it starts, applies every migration to a fresh database, and keeps running
//   2. started with --remote-debugging-port it exits with code 1 and the port is closed (O15)
//   3. ELECTRON_RUN_AS_NODE=1 does not turn it into Node (RunAsNode fuse)
import process from "node:process";
import { PACKAGE_FLAVOURS, findPackagedExecutable } from "./packagedApp/packagedApp.mjs";
import {
  countAppliedMigrations,
  countJournalMigrations,
  isPortOpen,
  startBinary,
  stopBinary,
  waitUntil,
} from "./smokeRelease/releaseProcess.mjs";

const START_TIMEOUT_MILLISECONDS = 30_000;
const EXIT_TIMEOUT_MILLISECONDS = 10_000;
const DEBUG_PORT = 47_913;
const NODE_MARKER = "SHOPOS_ACTED_AS_NODE";
const APP_FLAG = "--app";

function readAppPathArgument() {
  const flagPosition = process.argv.indexOf(APP_FLAG);
  return flagPosition === -1 ? undefined : process.argv[flagPosition + 1];
}

async function checkStartsAndMigrates(executable) {
  const started = startBinary(executable, []);
  const journalCount = countJournalMigrations();
  const isMigrated = await waitUntil(
    () => countAppliedMigrations(started) === journalCount,
    START_TIMEOUT_MILLISECONDS,
  );
  const isStillRunning = started.exitCode === undefined;
  await stopBinary(started);
  return {
    name: `starts and applies ${journalCount} migrations`,
    isPassed: isMigrated && isStillRunning,
  };
}

async function checkRefusesDebugPort(executable) {
  const started = startBinary(executable, [`--remote-debugging-port=${DEBUG_PORT}`]);
  const hasExited = await waitUntil(
    () => started.exitCode !== undefined,
    EXIT_TIMEOUT_MILLISECONDS,
  );
  const isPortLeftOpen = await isPortOpen(DEBUG_PORT);
  await stopBinary(started);
  const isPassed = hasExited && started.exitCode === 1 && !isPortLeftOpen;
  return { name: "refuses --remote-debugging-port (O15)", isPassed };
}

async function checkIgnoresRunAsNode(executable) {
  const nodeScript = `process.stdout.write("${NODE_MARKER}")`;
  const started = startBinary(executable, ["-e", nodeScript], { ELECTRON_RUN_AS_NODE: "1" });
  await waitUntil(() => started.exitCode !== undefined, EXIT_TIMEOUT_MILLISECONDS);
  await stopBinary(started);
  return {
    name: "ignores ELECTRON_RUN_AS_NODE",
    isPassed: !started.outputText.includes(NODE_MARKER),
  };
}

const executable = readAppPathArgument() ?? findPackagedExecutable(PACKAGE_FLAVOURS.release);
if (!executable) {
  process.stderr.write("No release build under apps/desktop/release. Run `pnpm package` first.\n");
  process.exit(1);
}

const results = [];
for (const runCheck of [checkStartsAndMigrates, checkRefusesDebugPort, checkIgnoresRunAsNode]) {
  results.push(await runCheck(executable));
}
results.forEach((result) =>
  process.stdout.write(`${result.isPassed ? "PASS" : "FAIL"}  ${result.name}\n`),
);
const hasFailure = results.some((result) => !result.isPassed);
process.exit(hasFailure ? 1 : 0);
