# Contract: quality commands and CI jobs

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:f3ca961490a5bf3223a52d58fa88234f467c99c90d7b2b3adaa70c1aba2b8870 -->

## Developer and CI commands

| Command                                                                     | Does                                                                                                                           | Output                                         |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `pnpm quality:dataset --profile <release or scale> --seed <n> --out <file>` | Builds a dataset through the app's repositories (research D1)                                                                  | SQLite file; prints size and time              |
| `pnpm quality:bench --dataset <file> [--printer <profile>]`                 | Builds the packaged app if needed, starts it with `SHOPOS_BENCH=1`, runs the measures                                          | `quality/runs/<date>-<version>-<profile>.json` |
| `pnpm quality:offline`                                                      | Packaged run with the network denied, crash-during-save loop, duplicate-save test, sync simulation if present                  | `quality/offline/<date>-<version>.json`        |
| `pnpm quality:security`                                                     | PIN scan on a test database and logs, `pnpm audit --prod`, 018 checks, HTTPS-only check if a server is configured              | Console report; non-zero exit on failure       |
| `pnpm quality:a11y`                                                         | Playwright plus axe-core on every screen in light and dark; 44 px target check on counter screens                              | Report in `test-results/`                      |
| `pnpm quality:print-snapshots`                                              | Renders bill, return, quote, challan and statement layouts at 58 mm, 80 mm, A4 and A5 to PDF as each layout becomes available; compares with approved snapshots | Diffs on failure                               |
| `pnpm quality:release-record <version>`                                     | Creates `quality/releases/<version>.md` from the template before tagging; CI result and link are pending                                              | File                                           |

<!-- /coderabbit-ai-generated:v1 -->

## App behaviour (bench mode)

With `SHOPOS_BENCH=1` and `SHOPOS_BENCH_DATASET=<file>` the packaged app copies the dataset to a throwaway user-data folder with the online backup API, signs in a bench user, runs the measures through the real services, writes the JSON result, and exits. Bench mode is refused when the user-data folder is the shop's real one.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:511afddaa09d09363f713c7536c930f024e7dc321fa440ca69895d4282381508 -->

## CI job `release-gate` (on tags `v*`)

Needs all of: unit and integration tests, e2e, `quality:offline`, `quality:print-snapshots`, `quality:a11y`, `quality:security`, a benchmark result for this version within 14 days, a release record with all applicable manual items completed in the tagged commit, and zero open issues labelled `bill-integrity`. Each measure in that benchmark result must meet its budget or have a documented owner acceptance for that specific miss. Any failure blocks the release (FR-017).

## Release record workflow

1. **Before tagging:** Run `pnpm quality:release-record <version>`. The operator fills in the applicable manual items and commits the record before creating the tag. The tag-triggered gate expects the CI result and link to be pending.
2. **Before publication:** After the first `release-gate` run for the tag concludes, the operator edits the same record to add its result and link, then commits the update on the release branch without moving the tag. If that run fails, retain its evidence and record the result and link of any passing rerun before publishing. Publish only once the gate has passed for the tagged commit and the CI evidence is committed.

<!-- /coderabbit-ai-generated:v1 -->
