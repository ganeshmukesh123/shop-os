// Builds the e2e package flavour (electron-builder.e2e.yml) under release-e2e/, with the main
// bundle's debug-switch check turned off at build time (SHOPOS_E2E_BUILD=1, spec 018 O15).
// Node, not a shell `VAR=1 cmd` line, so it runs the same on Windows.
import { spawnSync } from "node:child_process";
import process from "node:process";
import { DESKTOP_FOLDER } from "./packagedApp/packagedApp.mjs";

const e2eEnvironment = { ...process.env, SHOPOS_E2E_BUILD: "1" };
const STEPS = [
  ["electron-vite", ["build"]],
  ["electron-builder", ["--config", "electron-builder.e2e.yml"]],
];

const failedStep = STEPS.find(([command, commandArguments]) => {
  const stepResult = spawnSync("pnpm", ["exec", command, ...commandArguments], {
    cwd: DESKTOP_FOLDER,
    stdio: "inherit",
    env: e2eEnvironment,
    shell: process.platform === "win32",
  });
  return stepResult.status !== 0;
});
process.exit(failedStep ? 1 : 0);
