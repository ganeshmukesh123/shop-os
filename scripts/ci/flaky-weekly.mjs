// Weekly flake report (spec 017, task T041): reads the end-to-end results of the last 7 days of CI runs
// and opens (or comments on) one issue per test that passed only on retry in two or more runs.
//
// Needs the GitHub CLI and a token (`GH_TOKEN`) allowed to read Actions and write issues. Run by
// .github/workflows/flaky-weekly.yml; to try it without writing issues:  DRY_RUN=1 node scripts/ci/flaky-weekly.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { findFlakyTests } from "./flaky-summary.mjs";
import {
  buildWeeklyMarkdown,
  findRecurring,
  groupFlakyTests,
  issueBody,
  isMissingArtifactError,
  issueTitle,
} from "./flaky-weekly-lib.mjs";

const DAYS_BACK = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const REPORT_ARTIFACT = "playwright-report";
const repository = process.env.GITHUB_REPOSITORY;
const isDryRun = process.env.DRY_RUN === "1";

function runGitHub(cliArguments) {
  return execFileSync("gh", cliArguments, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Ids of finished CI runs from the last week (cancelled runs have no results). */
function listRecentRunIds() {
  const since = new Date(Date.now() - DAYS_BACK * MILLISECONDS_PER_DAY).toISOString();
  const output = runGitHub([
    "api",
    "--paginate",
    `repos/${repository}/actions/workflows/ci.yml/runs?created=>=${since}&status=completed&per_page=100`,
    "--jq",
    '.workflow_runs[] | select(.conclusion == "success" or .conclusion == "failure") | .id',
  ]);
  return output.split("\n").filter(Boolean).map(Number);
}

/** Downloads one run's report; false when the run has none (not uploaded, or expired). */
function downloadReport(runId, target) {
  try {
    runGitHub([
      "run",
      "download",
      String(runId),
      "-R",
      repository,
      "-n",
      REPORT_ARTIFACT,
      "-D",
      target,
    ]);
    return true;
  } catch (caughtError) {
    const errorText = String(caughtError.stderr ?? caughtError.message);
    if (isMissingArtifactError(errorText)) {
      return false;
    }
    throw caughtError;
  }
}

/**
 * One run's flaky tests. A run with no report is skipped; a run whose report could not be read is
 * "incomplete", so the summary can say the counts may be short instead of silently dropping it.
 */
function readRun(runId, workFolder) {
  const target = path.join(workFolder, String(runId));
  try {
    const hasReport = downloadReport(runId, target);
    if (hasReport) {
      const report = JSON.parse(
        fs.readFileSync(path.join(target, "test-results", "results.json"), "utf8"),
      );
      return { kind: "read", runId, flakyTests: findFlakyTests(report) };
    }
    return { kind: "missing", runId };
  } catch (caughtError) {
    return { kind: "incomplete", runId, reason: String(caughtError.message).split("\n")[0] };
  }
}

function reportToIssue(group) {
  const title = issueTitle(group);
  const body = issueBody(group, repository);
  const existing = JSON.parse(
    runGitHub([
      "issue",
      "list",
      "-R",
      repository,
      "--state",
      "open",
      "--search",
      `"${title}" in:title`,
      "--json",
      "number,title",
    ]),
  ).find((issue) => issue.title === title);
  if (existing) {
    runGitHub(["issue", "comment", String(existing.number), "-R", repository, "--body", body]);
    return `commented on #${existing.number}`;
  }
  runGitHub(["issue", "create", "-R", repository, "--title", title, "--body", body]);
  return "opened an issue";
}

function main() {
  if (!repository) throw new Error("GITHUB_REPOSITORY is not set (owner/name).");
  const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-flaky-"));
  const results = listRecentRunIds().map((runId) => readRun(runId, workFolder));
  const runs = results.filter((result) => result.kind === "read");
  const incompleteRuns = results.filter((result) => result.kind === "incomplete");
  const groups = groupFlakyTests(runs);
  const recurring = findRecurring(groups);
  const incompleteRunIds = incompleteRuns.map((result) => result.runId);
  const markdown = buildWeeklyMarkdown({
    runCount: runs.length,
    groups,
    recurring,
    incompleteRunIds,
  });
  process.stdout.write(`${markdown}\n`);
  incompleteRuns.forEach((result) =>
    process.stdout.write(`::warning::Run ${result.runId} could not be read: ${result.reason}\n`),
  );
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  for (const group of recurring) {
    process.stdout.write(
      `${group.file}: ${group.title}: ${isDryRun ? "dry run, no issue" : reportToIssue(group)}\n`,
    );
  }
}

main();
