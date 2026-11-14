import { defineConfig } from "vitest/config";
import { buildCoverageOptions } from "../../config/coverage";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    coverage: buildCoverageOptions(["src/**"]),
  },
});
