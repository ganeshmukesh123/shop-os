import { defineConfig } from "vitest/config";
import { buildCoverageOptions } from "../../config/coverage";

export default defineConfig({
  test: {
    // describe, it, expect, vi and the hooks are available in tests without importing them.
    globals: true,
    testTimeout: 30000,
    coverage: buildCoverageOptions(["src/**/*.{ts,tsx}"]),
    projects: [
      {
        extends: true,
        test: {
          name: "main",
          // A test lives beside its code (T093: `src/main/**/x.test.ts`) or in the shared tests folders.
          include: [
            "tests/unit/**/*.test.ts",
            "tests/integration/**/*.test.ts",
            "src/main/**/*.test.ts",
          ],
        },
      },
      {
        // The React renderer runs in a browser; jsdom stands in for it (spec 017 T027).
        extends: true,
        test: {
          name: "renderer",
          include: ["tests/renderer/**/*.test.{ts,tsx}", "src/renderer/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["tests/setup/renderer.ts"],
        },
      },
    ],
  },
});
