// Lists end-to-end tests that passed only on retry, from Playwright's JSON report (spec 017, FR-015, FR-022).
//
//   report: "passes only on retry" results [failed (retry 0), passed (retry 1)]  ->  flaky
//
// A retry may keep a build green but must never hide a flake: this report puts every one in the job summary.
// Usage: node scripts/ci/flaky-summary.mjs apps/desktop/test-results/results.json
import fs from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

const FLAKY_STATUS = "flaky";

function collectSpecs(suites, parentTitles = []) {
  return suites.flatMap((suite) => {
    const titles = suite.title ? [...parentTitles, suite.title] : parentTitles;
    const ownSpecs = (suite.specs ?? []).map((spec) => ({ spec, titles }));
    return [...ownSpecs, ...collectSpecs(suite.suites ?? [], titles)];
  });
}

/** @returns {{ title: string, file: string, failedAttempts: number }[]} */
export function findFlakyTests(report) {
  return collectSpecs(report.suites ?? []).flatMap(({ spec }) =>
    spec.tests
      .filter((test) => test.status === FLAKY_STATUS)
      .map((test) => ({
        title: spec.title,
        file: spec.file,
        failedAttempts: test.results.filter((result) => result.status !== "passed").length,
      })),
  );
}

export function buildFlakyMarkdown(flakyTests) {
  const header = "## End-to-end flakes";
  const rows = flakyTests.map(
    (flaky) => `- \`${flaky.file}\`: ${flaky.title} (failed ${flaky.failedAttempts}x, then passed)`,
  );
  const body =
    flakyTests.length === 0
      ? ["No test needed a retry."]
      : [
          `${flakyTests.length} test(s) passed only on retry. Fix them or open an issue; a test that flakes twice in a week must not be ignored.`,
          "",
          ...rows,
        ];
  return [header, "", ...body].join("\n");
}

function appendToJobSummary(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  fs.appendFileSync(summaryPath, `${markdown}\n`);
}

function runFromCommandLine() {
  const reportPath = process.argv[2];
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const markdown = buildFlakyMarkdown(findFlakyTests(report));
  process.stdout.write(`${markdown}\n`);
  appendToJobSummary(markdown);
}

const isRunDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isRunDirectly) runFromCommandLine();
