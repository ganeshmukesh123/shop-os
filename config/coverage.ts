/**
 * The one place for the coverage rules (spec 017, FR-010 to FR-013).
 *
 * Gate: the 90% threshold is applied only when COVERAGE_ENFORCE is true. It is switched on by its own
 * pull request (task T036) once `main` already measures 90% on every metric. Until then CI reports
 * coverage and blocks nothing.
 *
 * Exclusions: keep this list short and reviewed. Adding one needs a written reason in the PR.
 */
export const COVERAGE_THRESHOLD_PERCENT = 90;

/** Report-only until the project reaches 90%. */
export const COVERAGE_ENFORCE = false;

/** Generated files, type declarations and the test folders themselves. Nothing else. */
export const COVERAGE_EXCLUDED_PATHS = [
  "**/*.d.ts",
  "**/tests/**",
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.spec.ts",
  "**/drizzle/**",
  "**/dist/**",
  "**/out/**",
  "**/coverage/**",
  "**/node_modules/**",
];

export const COVERAGE_REPORTERS = ["text", "lcov", "json-summary", "html"];

interface IProcessLike {
  process?: { env?: Record<string, string | undefined> };
}

/** Lets a developer try the gate locally (`COVERAGE_ENFORCE=true pnpm test:coverage`) without editing this file. */
function isEnforcedByEnvironment(): boolean {
  return (globalThis as IProcessLike).process?.env?.COVERAGE_ENFORCE === "true";
}

export function isCoverageEnforced(): boolean {
  return COVERAGE_ENFORCE || isEnforcedByEnvironment();
}

/** Vitest coverage options shared by every package. `sourceGlobs` says which files count (the code files under `src/`; vitest 4 parses every matched file, so non-code files such as HTML must not match). */
export function buildCoverageOptions(sourceGlobs: string[]) {
  const thresholdOptions = {
    lines: COVERAGE_THRESHOLD_PERCENT,
    statements: COVERAGE_THRESHOLD_PERCENT,
    functions: COVERAGE_THRESHOLD_PERCENT,
    branches: COVERAGE_THRESHOLD_PERCENT,
  };
  return {
    provider: "v8" as const,
    reporter: COVERAGE_REPORTERS,
    reportsDirectory: "coverage",
    include: sourceGlobs,
    exclude: COVERAGE_EXCLUDED_PATHS,
    ...(isCoverageEnforced() && { thresholds: thresholdOptions }),
  };
}
