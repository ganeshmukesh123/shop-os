// Release check (spec 018 FR-006): reads the fuse wire of the PACKAGED app and exits non-zero,
// naming each fuse, when it differs from the contract. Run `pnpm package` first.
//
//   pnpm check:fuses                     check the app electron-builder wrote under release/
//   pnpm check:fuses --app <path>        check another build (a .app, .exe or Linux binary)
//
// Never point it at node_modules/electron: the dev and test binary is left unhardened (FR-005).
import process from "node:process";
import { getCurrentFuseWire } from "@electron/fuses";
import { EXPECTED_FUSES, findFuseDifferences } from "./fuseCheck/fuseCheck.mjs";
import { PACKAGE_FLAVOURS, findPackagedExecutable } from "./packagedApp/packagedApp.mjs";

const APP_FLAG = "--app";
const say = (text) => process.stdout.write(`${text}\n`);
const fail = (text) => process.stderr.write(`${text}\n`);

function readAppPathArgument() {
  const flagPosition = process.argv.indexOf(APP_FLAG);
  return flagPosition === -1 ? undefined : process.argv[flagPosition + 1];
}

const appPath = readAppPathArgument() ?? findPackagedExecutable(PACKAGE_FLAVOURS.release);
if (!appPath) {
  fail(
    "No packaged app under apps/desktop/release. Run `pnpm package` first, or pass --app <path>.",
  );
  process.exit(1);
}

const fuseWire = await getCurrentFuseWire(appPath);
const differences = findFuseDifferences(fuseWire, EXPECTED_FUSES);
if (differences.length > 0) {
  fail(`Fuse check FAILED for ${appPath}:`);
  differences.forEach((difference) => fail(`  ${difference}`));
  process.exit(1);
}
say(`Fuse check passed for ${appPath}: ${EXPECTED_FUSES.length} fuses as expected.`);
