import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { parseFlags, readPackageSummaries } from "./coverage-summary.mjs";
import {
  buildCoverageMarkdown,
  combineTotals,
  describeStatus,
  findFilesBelowThreshold,
  formatPercent,
  parseCoverageSettings,
  percentOf,
} from "./coverage-summary-lib.mjs";

const THRESHOLD_PERCENT = 90;

function buildTotals(covered, total) {
  const metric = { total, covered };
  return { lines: metric, statements: metric, functions: metric, branches: metric };
}

function buildSummary(fileEntries) {
  const allTotals = Object.values(fileEntries);
  return { total: combineTotals(allTotals), ...fileEntries };
}

describe("percentOf and formatPercent", () => {
  it("computes covered over total", () => {
    assert.equal(percentOf({ total: 421, covered: 283 }).toFixed(2), "67.22");
  });

  it("treats an empty metric as fully covered", () => {
    assert.equal(percentOf({ total: 0, covered: 0 }), 100);
  });

  it("formats with two decimals and a percent sign", () => {
    assert.equal(formatPercent(67.2209), "67.22%");
    assert.equal(formatPercent(100), "100.00%");
  });
});

describe("combineTotals", () => {
  it("adds counts instead of averaging percentages", () => {
    const small = buildTotals(10, 10); // 100%
    const large = buildTotals(0, 90); // 0%
    const combined = combineTotals([small, large]);
    assert.equal(percentOf(combined.lines), 10); // not the 50% an average would give
  });
});

describe("describeStatus", () => {
  it("is OK when every metric meets the threshold", () => {
    assert.equal(describeStatus(buildTotals(90, 100), THRESHOLD_PERCENT), "OK");
  });

  it("names the threshold when the lowest metric is under it", () => {
    const totals = { ...buildTotals(95, 100), branches: { total: 100, covered: 80 } };
    assert.equal(describeStatus(totals, THRESHOLD_PERCENT), "Below 90%");
  });
});

describe("findFilesBelowThreshold", () => {
  it("lists files under the threshold, worst first, with relative paths", () => {
    const summary = buildSummary({
      "/repo/packages/core/src/good.ts": buildTotals(100, 100),
      "/repo/packages/core/src/bad.ts": buildTotals(10, 100),
      "/repo/packages/core/src/middling.ts": buildTotals(85, 100),
    });
    const files = findFilesBelowThreshold(summary, THRESHOLD_PERCENT, "/repo/packages/core");
    assert.deepEqual(
      files.map((file) => file.filePath),
      ["src/bad.ts", "src/middling.ts"],
    );
  });
});

const SAMPLE_PACKAGES = [
  {
    name: "core",
    summary: buildSummary({ "/r/src/a.ts": buildTotals(67, 100) }),
    rootDirectory: "/r",
  },
];

describe("buildCoverageMarkdown rows and gate label", () => {
  const packages = SAMPLE_PACKAGES;

  it("labels report-only mode and shows a row per package plus a combined row", () => {
    const markdown = buildCoverageMarkdown({ packages, thresholdPercent: 90, isEnforced: false });
    assert.match(markdown, /Gate: report only/);
    assert.match(markdown, /\| core \| 67\.00% \| 67\.00% \| 67\.00% \| 67\.00% \| Below 90% \|/);
    assert.match(markdown, /\*\*Combined\*\*/);
    assert.match(markdown, /src\/a\.ts/);
  });

  it("labels the gate as ON when enforced", () => {
    const markdown = buildCoverageMarkdown({ packages, thresholdPercent: 90, isEnforced: true });
    assert.match(markdown, /Gate: ON/);
  });
});

describe("buildCoverageMarkdown extras and limits", () => {
  const packages = SAMPLE_PACKAGES;

  it("appends extra lines such as the PR size", () => {
    const markdown = buildCoverageMarkdown({
      packages,
      thresholdPercent: 90,
      isEnforced: false,
      extraLines: ["PR size: 120 lines"],
    });
    assert.match(markdown, /PR size: 120 lines/);
  });

  it("caps the file list and says how many more there are", () => {
    const manyFiles = Object.fromEntries(
      Array.from({ length: 20 }, (_unusedEntry, index) => [
        `/r/src/f${index}.ts`,
        buildTotals(0, 10),
      ]),
    );
    const markdown = buildCoverageMarkdown({
      packages: [{ name: "big", summary: buildSummary(manyFiles), rootDirectory: "/r" }],
      thresholdPercent: 90,
      isEnforced: false,
    });
    assert.match(markdown, /and 5 more/);
  });
});

describe("parseCoverageSettings", () => {
  const SAMPLE_CONFIG =
    "export const COVERAGE_THRESHOLD_PERCENT = 90;\nexport const COVERAGE_ENFORCE = false;\n";

  it("reads the threshold and the gate state", () => {
    assert.deepEqual(parseCoverageSettings(SAMPLE_CONFIG), {
      thresholdPercent: 90,
      isEnforced: false,
    });
  });

  it("turns the gate on from the environment, as the vitest config does", () => {
    assert.equal(
      parseCoverageSettings(SAMPLE_CONFIG, { COVERAGE_ENFORCE: "true" }).isEnforced,
      true,
    );
  });

  it("throws instead of guessing when a setting is missing", () => {
    assert.throws(() => parseCoverageSettings("export const SOMETHING = 1;"), /no longer exports/);
  });

  it("understands the real config/coverage.ts", () => {
    const realConfigText = fs.readFileSync(path.resolve("config/coverage.ts"), "utf8");
    const settings = parseCoverageSettings(realConfigText);
    assert.equal(settings.thresholdPercent, 90);
    assert.equal(typeof settings.isEnforced, "boolean");
  });
});

describe("command line helpers", () => {
  it("collects repeated flags", () => {
    const flags = parseFlags([
      "--package",
      "core=a.json",
      "--package",
      "desktop=b.json",
      "--extra",
      "note",
    ]);
    assert.deepEqual(flags, [
      ["package", "core=a.json"],
      ["package", "desktop=b.json"],
      ["extra", "note"],
    ]);
  });

  it("reads a package summary and derives the package root from the file location", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "coverage-summary-"));
    fs.mkdirSync(path.join(folder, "pkg", "coverage"), { recursive: true });
    fs.writeFileSync(
      path.join(folder, "pkg", "coverage", "coverage-summary.json"),
      JSON.stringify(buildSummary({})),
    );
    const [packageSummary] = readPackageSummaries(
      [["package", "pkg=pkg/coverage/coverage-summary.json"]],
      folder,
    );
    assert.equal(packageSummary.name, "pkg");
    assert.equal(packageSummary.rootDirectory, path.join(folder, "pkg"));
  });
});
