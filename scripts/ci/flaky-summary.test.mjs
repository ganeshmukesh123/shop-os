import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFlakyMarkdown, findFlakyTests } from "./flaky-summary.mjs";

// Shaped like a real Playwright JSON report (generated with retries: 1 on 2026-11-14).
function buildSpec(title, status, resultStatuses) {
  const results = resultStatuses.map((resultStatus, retry) => ({ status: resultStatus, retry }));
  return { title, file: "billing.spec.ts", tests: [{ status, expectedStatus: "passed", results }] };
}

const SAMPLE_REPORT = {
  suites: [
    {
      title: "billing.spec.ts",
      specs: [buildSpec("always passes", "expected", ["passed"])],
      suites: [
        {
          title: "nested group",
          specs: [
            buildSpec("passes only on retry", "flaky", ["failed", "passed"]),
            buildSpec("always fails", "unexpected", ["failed", "failed"]),
          ],
        },
      ],
    },
  ],
};

describe("findFlakyTests", () => {
  it("returns only tests that failed and then passed, including nested suites", () => {
    const flakyTests = findFlakyTests(SAMPLE_REPORT);
    assert.deepEqual(flakyTests, [
      { title: "passes only on retry", file: "billing.spec.ts", failedAttempts: 1 },
    ]);
  });

  it("returns nothing when no test was flaky or the report is empty", () => {
    assert.deepEqual(findFlakyTests({ suites: [] }), []);
    assert.deepEqual(findFlakyTests({}), []);
  });
});

describe("buildFlakyMarkdown", () => {
  it("says no test needed a retry when the list is empty", () => {
    assert.match(buildFlakyMarkdown([]), /No test needed a retry/);
  });

  it("lists each flake with its attempts and the rule about repeats", () => {
    const markdown = buildFlakyMarkdown(findFlakyTests(SAMPLE_REPORT));
    assert.match(markdown, /1 test\(s\) passed only on retry/);
    assert.match(markdown, /passes only on retry \(failed 1x, then passed\)/);
    assert.match(markdown, /flakes twice in a week/);
  });
});
