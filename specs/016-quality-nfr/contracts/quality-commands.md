# Contract: quality commands and CI jobs

## Developer and CI commands

| Command                                                                     | Does                                                                                                                           | Output                                         |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `pnpm quality:dataset --profile <release or scale> --seed <n> --out <file>` | Builds a dataset through the app's repositories (research D1)                                                                  | SQLite file; prints size and time              |
| `pnpm quality:bench --dataset <file> [--printer <profile>]`                 | Builds the packaged app if needed, starts it with `SHOPOS_BENCH=1`, runs the measures                                          | `quality/runs/<date>-<version>-<profile>.json` |
| `pnpm quality:offline`                                                      | Packaged run with the network denied, crash-during-save loop, duplicate-save test, sync simulation if present                  | `quality/offline/<date>-<version>.json`        |
| `pnpm quality:security`                                                     | PIN scan on a test database and logs, `pnpm audit --prod`, 018 checks, HTTPS-only check if a server is configured              | Console report; non-zero exit on failure       |
| `pnpm quality:a11y`                                                         | Playwright plus axe-core on every screen in light and dark; 44 px target check on counter screens                              | Report in `test-results/`                      |
| `pnpm quality:print-snapshots`                                              | Renders bill, return, quote, challan and statement layouts at 58 mm, 80 mm, A4, A5 to PDF and compares with approved snapshots | Diffs on failure                               |
| `pnpm quality:release-record <version>`                                     | Creates `quality/releases/<version>.md` from the template with CI links filled in                                              | File                                           |

## App behaviour (bench mode)

With `SHOPOS_BENCH=1` and `SHOPOS_BENCH_DATASET=<file>` the packaged app copies the dataset to a throwaway user-data folder with the online backup API, signs in a bench user, runs the measures through the real services, writes the JSON result, and exits. Bench mode is refused when the user-data folder is the shop's real one.

## CI job `release-gate` (on tags `v*`)

Needs all of: unit and integration tests, e2e, `quality:offline`, `quality:print-snapshots`, `quality:a11y`, `quality:security`, a benchmark result for this version within 14 days, a complete `quality/releases/<version>.md`, and zero open issues labelled `bill-integrity`. Any failure blocks the release (FR-017).
