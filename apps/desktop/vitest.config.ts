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
          include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
        },
      },
      {
        // The React renderer runs in a browser; jsdom stands in for it (spec 017 T027).
        extends: true,
        test: {
          name: "renderer",
          include: ["tests/renderer/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["tests/setup/renderer.ts"],
        },
      },
    ],
  },
});
