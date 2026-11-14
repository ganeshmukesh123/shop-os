import { defineConfig } from "@playwright/test";

const IS_CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  // One retry on CI only. A test that passes on retry is reported as flaky (spec 017, FR-022);
  // locally a failure fails at once so a flake is never hidden from the developer.
  retries: IS_CI ? 1 : 0,
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // `list` for readable logs; `html` keeps the report and traces CI uploads as an artifact; `json` feeds
  // scripts/ci/flaky-summary.mjs, which lists tests that passed only on retry.
  reporter: IS_CI
    ? [["list"], ["html", { open: "never" }], ["json", { outputFile: "test-results/results.json" }]]
    : "list",
});
