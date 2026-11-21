# Research: Cross-Cutting Quality Requirements

**Feature**: `specs/016-quality-nfr/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD section 12 (NFR-001 to NFR-016), section 15 (success metrics and guardrails, risks), the architecture reference sections 2 (capacity estimate), 5.8, 12.1 and 12.2, the constitution v2.1.0 (Release: "only after offline testing passes"; principle VI "No known defect that can lose, duplicate or mis-total a bill may be open at release"), 001's plan (packaged e2e with `--offline` on macOS, crash-safety scenario, restore guide), 017 (CI workflow), 018 (security checklist), and the plans of 002 (search benchmark), 005 (PIN hashing), 010 (sync simulation, restore), 012 (release checklist, restore drills, training) and 014 (format scan).

**This feature owns the routine, not the behaviour** (spec assumption): each feature builds its own speed, offline and security behaviour; 016 builds the shared tools that measure them and the release gate that blocks a release when they fail.

**Build window**: 21 December 2026 to 3 January 2027 (002 research D16), before 002, so every later feature is measured from its first commit. Checks that need later features (sync, server, printers) are added by those features as extension points listed in `tasks.md`.

## Decisions

### D1. One seeded dataset generator, two sizes

- `pnpm quality:dataset --profile release|scale --seed 42` builds a SQLite file through the app's own repositories (so it obeys every trigger and check) with:
  - **release** profile: 50,000 variants in about 9,000 families, 1,000 parties, 2 years of 500 bills a day (about 365,000 bills).
  - **scale** profile: the same masters and **10 years** of 500 bills a day (about 1,825,000 bills and, at 6 lines a bill, about 11 million lines), 5 counters, 5 locations (NFR-014).
- **Messy data** (spec edge case): duplicate-looking names, 120-character names, Hindi and Hinglish search names, items without cost or HSN, negative stock, cancelled and edited bills, returns.
- **Size estimate** (arithmetic, not measured): about 300 bytes per bill line with indexes gives 3 to 4 GB for the scale profile; generation may take an hour or more. The scale profile therefore runs before major releases and monthly, the release profile on every release. The real size and time are recorded on first run (OI-1).
- No faker package: a small seeded generator with built-in word lists (constitution VII).

### D2. Benchmarks run inside the packaged app on the shop's own computer

- The packaged app accepts `SHOPOS_BENCH=1` with a dataset path; it opens the dataset with a throwaway user-data folder and runs the real services (not test doubles): 50 searches (002's list plus typos and Hindi), 100 bill saves, 20 save-and-print to PDF (and to the real printer when a profile exists, 015), the daily sales report (011), start-up time. Results are percentiles (p50, p95, max).
- "Ordinary shop PC" means the owner's counter computer, recorded with OS, CPU model, RAM and disk type from Node's `os` module (spec assumption).
- **Budgets** live in `quality/budgets.json` (data, not code), read from the PRD and the specs:

| Measure                              | Budget                                 | Source                                                    |
| ------------------------------------ | -------------------------------------- | --------------------------------------------------------- |
| Item search at 50,000 variants       | p95 at most 250 ms, p50 at most 200 ms | NFR-001 ("about a fifth of a second")                     |
| Bill save                            | p95 at most 300 ms                     | share of NFR-002                                          |
| Bill save and print (spooled or PDF) | p95 at most 1,000 ms                   | NFR-002                                                   |
| Today card on a phone connection     | at most 3,000 ms                       | NFR-003 (010 adds the measurement)                        |
| Daily sales report, 500 bills        | at most 3,000 ms                       | 011 SC-001                                                |
| App start to bill screen             | at most 5,000 ms                       | not in the PRD; a guardrail chosen here, owner may change |

The search budget's p95 reading of "about a fifth of a second" is this plan's interpretation (OI-2 for the owner).

- A miss is recorded as a known risk naming the hardware, not hidden (spec edge case); the release gate needs an owner's accepted note to pass with a miss.

### D3. The offline and no-lost-bill routine

| Check                                                  | How                                                                                                                               | Available from |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Counter works with no network                          | Packaged e2e with the network denied (001's `test:e2e:packaged --offline` on macOS; Windows and Linux via a firewall rule script) | Now            |
| Crash mid-save leaves a bill complete or absent        | Kill the process at random points of 50 saves; check each bill and its lines and movements                                        | Now            |
| Duplicate save impossible                              | Double-submit and retry with the same `clientBillId`                                                                              | Now (001 test) |
| 7 days offline, 2 counters and a phone, sync converges | 010's deterministic simulation (`pnpm test:sync-sim`)                                                                             | 010            |
| Last unit sold on two counters                         | Part of the simulation; stock -1 flagged                                                                                          | 010            |

- The release gate fails if any check fails or if any open issue is labelled `bill-integrity` (a GitHub label for defects that can lose, duplicate or mis-total a bill; constitution VI).

### D4. A backup counts only after a test restore, automatically

After every backup (001's second-drive copy, 010's cloud upload), the app restores it into a temporary scratch database, leaving the source backup read-only and the live database untouched. On the scratch database, run `PRAGMA integrity_check`, validate the app schema and every table required for that schema version, and compare the row counts of bills, lines, movements and ledger entries with the live database at the backup's time. Set `backup_log.verified_at` only after the restore and all checks pass; otherwise leave it unset and set `verify_error`. Remove the scratch database after verification. An unverified backup shows as a warning in 015's health check. The human restore drill by someone other than the builder stays in 012 and 015 (SC-003).

### D5. Security and privacy checks

| Check                            | Method                                                                                                                              | From |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---- |
| No readable PIN (SC-004)         | Scan every text column in the database and the log files for 4 to 6 digit values equal to a known test PIN; check `pin_hash` format | 005  |
| Data in transit                  | Server only on HTTPS; desktop CSP `connect-src` only the server origin; check with a test that a plain-HTTP call is refused         | 010  |
| Data at rest                     | Records whether SQLCipher is on (001 D4, deferred); OS disk encryption advised and checked by a manual item                         | Now  |
| Electron hardening               | 018's checklist (fuses, permissions, navigation, sandbox) as automated tests                                                        | 018  |
| Dependencies                     | `pnpm audit --prod` in CI with high and critical findings failing                                                                   | Now  |
| Remote log-out                   | 010's revoke test                                                                                                                   | 010  |
| Access logs kept at least 1 year | Test that no code path deletes `audit_log` rows; retention note                                                                     | 005  |
| Breach response                  | Yearly tabletop drill against 010's `breach-response.md`, recorded in `quality/drills/`                                             | 010  |

### D6. Accessibility, learnability and the other NFRs

- **Accessibility** (NFR-011): an automated scan of every screen in light and dark with axe-core in Playwright (package `@axe-core/playwright`, owner approval OD-1), plus a test that interactive elements are at least 44 by 44 CSS pixels on counter screens; "information not by colour alone" is a manual review item per screen (constitution X checklist).
- **Learnability** (NFR-010): 012's training records (5 unaided lines after 2 hours).
- **Language and formats** (NFR-012): 014's lint rule, key check and format scan.
- **Devices** (NFR-013): print-layout snapshot tests at 58 mm, 80 mm, A4 and A5 (HTML rendered to PDF and compared page by page) plus 015's manual hardware runs.
- **Traceability** (NFR-015): 011's reconciliation test and drill-down e2e.
- **Rules without a release** (NFR-016): a list of every rule and where it is set (`quality/rules-register.md`); a test that changing a discount limit or a GST rate takes effect on the next action without a restart.

### D7. Release gate in CI plus a signed checklist

- A CI job `release-gate` (017's workflow) runs on release tags: unit and integration tests, e2e, offline packaged run, crash test, sync simulation (when present), print snapshots, accessibility scan, dependency audit, `bill-integrity` issue check, and reads the latest benchmark result for that version.
- Manual items (benchmark on the shop's PC, hardware run, restore drill when due, breach drill when due) are ticked in `quality/releases/<version>.md`, and committed before tagging. Before publication, the operator adds the first gate run's result and link to the same record and commits the update. See the [release record workflow](contracts/quality-commands.md#release-record-workflow).
- **Where results live**: in the repository under `quality/` (budgets, run results as JSON, release records), not in the shop's database: they are about the software, not the shop.

## Open items

| ID   | Item                                                                  | Resolve by | Milestone |
| ---- | --------------------------------------------------------------------- | ---------- | --------- |
| OI-1 | Real size and generation time of the scale dataset                    | First run  | M1        |
| OI-2 | Search budget read as p95 at most 250 ms and p50 at most 200 ms       | Owner      | M1        |
| OI-3 | The owner's counter computer model and specs (the reference machine)  | Owner      | M1        |
| OI-4 | Network-deny method on Windows and Linux for the offline packaged run | Spike      | M2        |

## Owner decisions needed

| ID   | Question                                      | Recommendation | Needed by |
| ---- | --------------------------------------------- | -------------- | --------- |
| OD-1 | Add `@axe-core/playwright` (development only) | Yes            | M2        |

## References

- SQLite `PRAGMA integrity_check`: https://www.sqlite.org/pragma.html#pragma_integrity_check (primary).
- Playwright for Electron: https://playwright.dev/docs/api/class-electron (primary).
- axe-core and the Playwright integration: https://github.com/dequelabs/axe-core and https://playwright.dev/docs/accessibility-testing (primary).
- WCAG 2.2 success criterion 2.5.8 Target Size (Minimum) and 1.4.1 Use of Color: https://www.w3.org/TR/WCAG22/ (primary; 44 px is the stricter 2.5.5 enhanced target, chosen for a busy counter).
- pnpm audit: https://pnpm.io/cli/audit (primary).
- Industry practice: Google's SRE book treats untested backups as no backups and recommends automated restore verification (https://sre.google/sre-book/data-integrity/, company's own book). Chromium and Firefox keep performance budgets in CI and block regressions (Chromium perf sheriffing: https://chromium.googlesource.com/chromium/src/+/main/docs/speed/perf_regression_sheriffing.md, primary project documentation). Google's "Software Engineering at Google" chapter 11 describes presubmit and release testing gates (https://abseil.io/resources/swe-book/html/ch11.html, company's own book). D2, D4 and D7 follow these.
