/**
 * Fixed when the main bundle is built (electron.vite.config.ts `define`). True only for the e2e
 * package flavour (`pnpm package:e2e`), which Playwright drives; false for every release build.
 */
declare const __SHOPOS_ALLOWS_DEBUG_SWITCHES__: boolean;
