import { defineConfig } from "vitest/config";
import { buildCoverageOptions } from "../../config/coverage";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: buildCoverageOptions(["src/**"]),
  },
});
