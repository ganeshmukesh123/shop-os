// Pure rules for the weekly flake report (spec 017, task T041, FR-015, FR-022). No network, no files.
//
// Input: one entry per CI run, each with the end-to-end tests that passed only on retry in that run
// (from findFlakyTests). A test that was flaky in two or more different runs in the week is "recurring".
//
//   run 101: [billing "adds a line"]                 billing "adds a line": runs 101, 104  -> recurring
//   run 104: [billing "adds a line", pdf "exports"]  pdf "exports": run 104                -> once, ignored

export const RECURRING_MIN_RUNS = 2;

/** @param {{ runId: number, flakyTests: { file: string, title: string }[] }[]} runs */
export function groupFlakyTests(runs) {
  const groups = new Map();
  for (const run of runs) {
    for (const flaky of run.flakyTests) {
      const key = `${flaky.file}::${flaky.title}`;
      const group = groups.get(key) ?? { file: flaky.file, title: flaky.title, runIds: new Set() };
      group.runIds.add(run.runId);
      groups.set(key, group);
    }
  }
  return [...groups.values()].map((group) => ({ ...group, runIds: [...group.runIds] }));
}

export function findRecurring(groups, minRuns = RECURRING_MIN_RUNS) {
  return groups.filter((group) => group.runIds.length >= minRuns);
}

export function issueTitle(group) {
  return `Flaky test: ${group.file} - ${group.title}`;
}

export function issueBody(group, repository) {
  const runLinks = group.runIds.map(
    (runId) => `- https://github.com/${repository}/actions/runs/${runId}`,
  );
  return [
    `\`${group.file}\`: "${group.title}" failed and then passed on retry in ${group.runIds.length} CI runs this week.`,
    "",
    "A retry keeps the build green but hides a real problem (spec 017, FR-022). Find the cause (timing, shared state, a race) and fix it; do not raise the retry count.",
    "",
    "Runs:",
    ...runLinks,
  ].join("\n");
}

export function buildWeeklyMarkdown({ runCount, groups, recurring }) {
  const header = "## Weekly end-to-end flake report";
  const counts = `${runCount} CI run(s) checked; ${groups.length} test(s) needed a retry at least once; ${recurring.length} did so in ${RECURRING_MIN_RUNS} or more runs.`;
  const rows = recurring.map(
    (group) => `- \`${group.file}\`: ${group.title} (${group.runIds.length} runs)`,
  );
  return [header, "", counts, "", ...rows].join("\n");
}
