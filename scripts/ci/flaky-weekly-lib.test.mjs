import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWeeklyMarkdown,
  findRecurring,
  groupFlakyTests,
  issueBody,
  isMissingArtifactError,
  issueTitle,
} from "./flaky-weekly-lib.mjs";

const BILLING = { file: "billing.spec.ts", title: "adds a line" };
const PDF = { file: "pdf.spec.ts", title: "exports" };

describe("groupFlakyTests", () => {
  it("collects the runs in which the same test was flaky", () => {
    const groups = groupFlakyTests([
      { runId: 101, flakyTests: [BILLING] },
      { runId: 104, flakyTests: [BILLING, PDF] },
    ]);

    assert.deepEqual(
      groups.map((group) => [group.title, group.runIds]),
      [
        ["adds a line", [101, 104]],
        ["exports", [104]],
      ],
    );
  });

  it("counts a run once even if the report lists the test twice", () => {
    const groups = groupFlakyTests([{ runId: 101, flakyTests: [BILLING, BILLING] }]);

    assert.deepEqual(groups[0].runIds, [101]);
  });

  it("returns nothing when no run had a flake", () => {
    assert.deepEqual(groupFlakyTests([{ runId: 101, flakyTests: [] }]), []);
  });
});

describe("findRecurring", () => {
  it("keeps only tests that were flaky in two or more runs", () => {
    const groups = groupFlakyTests([
      { runId: 101, flakyTests: [BILLING] },
      { runId: 104, flakyTests: [BILLING, PDF] },
    ]);

    assert.deepEqual(
      findRecurring(groups).map((group) => group.title),
      ["adds a line"],
    );
  });
});

describe("issue text", () => {
  const group = { ...BILLING, runIds: [101, 104] };

  it("names the file and the test in the title", () => {
    assert.equal(issueTitle(group), "Flaky test: billing.spec.ts - adds a line");
  });

  it("links every run in the body", () => {
    const body = issueBody(group, "owner/shop");

    assert.match(body, /in 2 CI runs this week/);
    assert.match(body, /https:\/\/github\.com\/owner\/shop\/actions\/runs\/101/);
    assert.match(body, /https:\/\/github\.com\/owner\/shop\/actions\/runs\/104/);
  });
});

describe("buildWeeklyMarkdown", () => {
  it("says how many runs were checked and lists the recurring tests", () => {
    const group = { ...BILLING, runIds: [101, 104] };

    const markdown = buildWeeklyMarkdown({ runCount: 12, groups: [group], recurring: [group] });

    assert.match(
      markdown,
      /12 CI run\(s\) checked; 1 test\(s\) needed a retry at least once; 1 did so/,
    );
    assert.match(markdown, /- `billing\.spec\.ts`: adds a line \(2 runs\)/);
  });

  it("reports a quiet week", () => {
    const markdown = buildWeeklyMarkdown({ runCount: 5, groups: [], recurring: [] });

    assert.match(markdown, /0 test\(s\) needed a retry/);
    assert.doesNotMatch(markdown, /Incomplete/);
  });

  it("names the runs that could not be read, so a short count is explained", () => {
    const markdown = buildWeeklyMarkdown({
      runCount: 10,
      groups: [],
      recurring: [],
      incompleteRunIds: [205, 209],
    });

    assert.match(markdown, /\*\*Incomplete:\*\* 2 run\(s\) could not be read \(205, 209\)/);
  });
});

describe("isMissingArtifactError", () => {
  it("treats a run with no report, or an expired one, as an expected skip", () => {
    assert.equal(isMissingArtifactError("no valid artifacts found to download"), true);
    assert.equal(
      isMissingArtifactError("no artifact matches any of the names or patterns provided"),
      true,
    );
  });

  it("treats any other download failure as a run that could not be read", () => {
    assert.equal(isMissingArtifactError("HTTP 502: Bad Gateway"), false);
    assert.equal(isMissingArtifactError("error connecting to api.github.com"), false);
  });
});
