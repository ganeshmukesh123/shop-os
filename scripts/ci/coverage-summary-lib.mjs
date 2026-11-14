// Pure functions that turn coverage-summary.json data into a Markdown report (spec 017, FR-013, FR-014).
// No file or environment access here, so every function is unit-tested (coverage-summary.test.mjs).
//
//   | Package   | Lines  | Statements | Functions | Branches | Status      |
//   | core      | 67.22% | 67.22%     | 87.87%    | 86.88%   | Below 90%   |

export const METRIC_NAMES = ["lines", "statements", "functions", "branches"];
export const MAX_FILES_LISTED_PER_PACKAGE = 15;

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** An empty package (no statements) counts as fully covered; the report says so by showing 100%. */
export function percentOf(metric) {
  return metric.total === 0 ? 100 : (metric.covered / metric.total) * 100;
}

export function formatPercent(percent) {
  return `${NUMBER_FORMATTER.format(percent)}%`;
}

/** Adds up covered and total counts across packages, so the combined figure is not an average of averages. */
export function combineTotals(totalsList) {
  const combinedEntries = METRIC_NAMES.map((metricName) => {
    const total = totalsList.reduce((sum, totals) => sum + totals[metricName].total, 0);
    const covered = totalsList.reduce((sum, totals) => sum + totals[metricName].covered, 0);
    return [metricName, { total, covered }];
  });
  return Object.fromEntries(combinedEntries);
}

export function lowestPercent(totals) {
  return Math.min(...METRIC_NAMES.map((metricName) => percentOf(totals[metricName])));
}

export function describeStatus(totals, thresholdPercent) {
  return lowestPercent(totals) >= thresholdPercent ? "OK" : `Below ${thresholdPercent}%`;
}

const THRESHOLD_PATTERN = /export const COVERAGE_THRESHOLD_PERCENT = (\d+);/;
const ENFORCE_PATTERN = /export const COVERAGE_ENFORCE = (true|false);/;

/**
 * Reads the threshold and gate state from the text of config/coverage.ts, so the report cannot disagree with the build.
 * Throws when a setting is missing: a wrong "report only" label after the gate is on would be worse than a failed step.
 */
export function parseCoverageSettings(configSourceText, environment = {}) {
  const thresholdMatch = THRESHOLD_PATTERN.exec(configSourceText);
  const enforceMatch = ENFORCE_PATTERN.exec(configSourceText);
  if (!thresholdMatch || !enforceMatch) {
    throw new Error(
      "config/coverage.ts no longer exports COVERAGE_THRESHOLD_PERCENT and COVERAGE_ENFORCE as literals.",
    );
  }
  return {
    thresholdPercent: Number(thresholdMatch[1]),
    isEnforced: enforceMatch[1] === "true" || environment.COVERAGE_ENFORCE === "true",
  };
}

function buildRow(label, totals, thresholdPercent) {
  const percentCells = METRIC_NAMES.map((metricName) =>
    formatPercent(percentOf(totals[metricName])),
  );
  return `| ${label} | ${percentCells.join(" | ")} | ${describeStatus(totals, thresholdPercent)} |`;
}

/** Files where any metric is under the threshold, worst first, with paths shown relative to rootDirectory. */
export function findFilesBelowThreshold(summary, thresholdPercent, rootDirectory) {
  return Object.entries(summary)
    .filter(([filePath]) => filePath !== "total")
    .map(([filePath, totals]) => ({
      filePath: filePath.startsWith(rootDirectory)
        ? filePath.slice(rootDirectory.length + 1)
        : filePath,
      lowest: lowestPercent(totals),
    }))
    .filter((file) => file.lowest < thresholdPercent)
    .sort((first, second) => first.lowest - second.lowest);
}

function buildUncoveredSection(packageName, files) {
  const listedFiles = files.slice(0, MAX_FILES_LISTED_PER_PACKAGE);
  const hiddenCount = files.length - listedFiles.length;
  const lines = listedFiles.map((file) => `- \`${file.filePath}\`: ${formatPercent(file.lowest)}`);
  const moreLine = hiddenCount > 0 ? [`- and ${hiddenCount} more`] : [];
  return [
    `<details><summary>${packageName}: ${files.length} files below the threshold</summary>`,
    "",
    ...lines,
    ...moreLine,
    "",
    "</details>",
  ];
}

/**
 * @param {{ packages: { name: string, summary: object, rootDirectory: string }[], thresholdPercent: number,
 *           isEnforced: boolean, extraLines?: string[] }} options
 */
export function buildCoverageMarkdown({ packages, thresholdPercent, isEnforced, extraLines = [] }) {
  const rows = packages.map((item) => buildRow(item.name, item.summary.total, thresholdPercent));
  const combined = combineTotals(packages.map((item) => item.summary.total));
  const gateLine = isEnforced
    ? `Gate: ON. Any metric below ${thresholdPercent}% fails the build.`
    : `Gate: report only. The ${thresholdPercent}% threshold is not enforced yet (spec 017).`;
  const uncoveredSections = packages
    .map((item) => ({
      item,
      files: findFilesBelowThreshold(item.summary, thresholdPercent, item.rootDirectory),
    }))
    .filter(({ files }) => files.length > 0)
    .flatMap(({ item, files }) => buildUncoveredSection(item.name, files));
  return [
    "## Coverage",
    "",
    gateLine,
    "",
    "| Package | Lines | Statements | Functions | Branches | Status |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    buildRow("**Combined**", combined, thresholdPercent),
    "",
    ...uncoveredSections,
    ...extraLines,
  ].join("\n");
}
