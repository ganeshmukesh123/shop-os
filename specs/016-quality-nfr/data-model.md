# Data Model: Cross-Cutting Quality Requirements

Most artefacts are files in the repository, because they describe the software, not the shop (research D7). One column is added to the app database. Decisions in `research.md` D1 to D7.

## Repository files (`quality/`)

```
quality/
├── budgets.json                 # measure -> { p50Ms?, p95Ms?, maxMs?, source }
├── runs/
│   └── <date>-<version>-<profile>.json   # one benchmark run
├── offline/
│   └── <date>-<version>.json   # offline and crash routine results
├── releases/
│   └── <version>.md            # release gate record (automated results linked, manual items ticked)
├── drills/
│   └── <date>-<kind>.md        # restore drills, breach tabletop drills
└── rules-register.md           # every shop rule and where it is changed (NFR-016)
```

### Benchmark run (`runs/*.json`)

`version`, `profile` (`release`, `scale`), `seed`, `datasetBytes`, `machine` (`os`, `cpuModel`, `cpuCount`, `ramBytes`, `diskKind` typed by the operator), `measures` (per measure: `samples`, `p50Ms`, `p95Ms`, `maxMs`, `budget`, `isWithinBudget`), `misses` (each with an accepted-by note or empty), `ranAt`, `sourceCommit` (the full commit hash of the source that was built and measured).

### Offline routine result (`offline/*.json`)

`version`, `checks` (per check: `name`, `passed`, `details`), `simulation` (when 010 exists: devices, days, operations, duplicates found, lost found, negative-stock flags).

### Release record (`releases/<version>.md`)

CI evidence: pending in the tagged record; before publication the operator adds the first `release-gate` run's result and link, with each job's result. Manual items completed before tagging: benchmark on the reference machine, hardware run (015), restore drill if due, breach drill if due, open `bill-integrity` issues = 0, owner's acceptance of any budget miss.

## App database change

`backup_log` (001) adds `verified_at` (nullable epoch ms) and `verify_error` (nullable text): set after the automatic test restore (research D4). A backup without `verified_at` is shown as unverified.

## Derived values

- In a dev-only package `tools/quality` (not shipped): `percentile(samples, p)`, `compareWithBudget(measure, budgets)`, `generateDataset(profile, seed)`.
- In the app: `verifyBackup(backupPath, liveCounts)` returning ok or the failing check.

Example run line: `{ "measure": "search", "p50Ms": 41, "p95Ms": 88, "budget": { "p95Ms": 250 }, "isWithinBudget": true }`.
