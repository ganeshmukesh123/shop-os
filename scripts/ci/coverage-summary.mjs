// Writes the coverage table for a CI run (spec 017, FR-013, FR-014).
//
// Usage:
//   node scripts/ci/coverage-summary.mjs --package core=packages/core/coverage/coverage-summary.json \
//        --package desktop=apps/desktop/coverage/coverage-summary.json [--extra "PR size: 120 lines"]
//
// Prints the Markdown, and appends it to the GitHub job summary when GITHUB_STEP_SUMMARY is set.
// Threshold and gate state are read from config/coverage.ts so this report never disagrees with the build.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { buildCoverageMarkdown, parseCoverageSettings } from "./coverage-summary-lib.mjs";

const COVERAGE_CONFIG_PATH = "config/coverage.ts";

/** Collects repeated `--flag value` pairs: [["package", "core=path"], ["extra", "text"]]. */
export function parseFlags(argumentList) {
  return argumentList
    .map((argument, index) => [argument, argumentList[index + 1]])
    .filter(([argument]) => argument.startsWith("--"))
    .map(([argument, value]) => [argument.slice(2), value]);
}

export function readPackageSummaries(flags, workingDirectory) {
  return flags
    .filter(([flagName]) => flagName === "package")
    .map(([, value]) => {
      const [name, summaryPath] = value.split("=");
      const absolutePath = path.resolve(workingDirectory, summaryPath);
      const summary = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
      const packageRoot = path.dirname(path.dirname(absolutePath));
      return { name, summary, rootDirectory: packageRoot };
    });
}

function readCoverageSettings() {
  const configSourceText = fs.readFileSync(path.resolve(COVERAGE_CONFIG_PATH), "utf8");
  return parseCoverageSettings(configSourceText, process.env);
}

/** On GitHub, the Markdown also goes to the job summary page. Elsewhere there is nothing to append to. */
function appendToJobSummary(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  fs.appendFileSync(summaryPath, `${markdown}\n`);
}

function runFromCommandLine() {
  const flags = parseFlags(process.argv.slice(2));
  const packages = readPackageSummaries(flags, process.cwd());
  const extraLines = flags.filter(([flagName]) => flagName === "extra").map(([, value]) => value);
  const { thresholdPercent, isEnforced } = readCoverageSettings();
  const markdown = buildCoverageMarkdown({ packages, thresholdPercent, isEnforced, extraLines });
  process.stdout.write(`${markdown}\n`);
  appendToJobSummary(markdown);
}

const isRunDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isRunDirectly) runFromCommandLine();
