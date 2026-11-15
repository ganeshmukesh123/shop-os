import { defineConfig } from "vitest/config";
import { buildCoverageOptions } from "../../config/coverage";

export default defineConfig({
  test: {
    // describe, it, expect, vi and the hooks are available in tests without importing them.
    globals: true,
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    coverage: buildCoverageOptions(["src/**/*.{ts,tsx}"]),
  },
});
