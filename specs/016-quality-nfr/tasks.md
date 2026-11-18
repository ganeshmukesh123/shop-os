---
description: "Task list for feature 016: datasets, benchmarks, offline routine, backup verification, security, accessibility, release gate"
---

# Tasks: Cross-Cutting Quality Requirements

**Input**: Design documents from `/specs/016-quality-nfr/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/quality-commands.md, quickstart.md. Features 001 and 017 merged.

**Tests**: The tooling's own logic is unit-tested; backup verification (it reads every backup) is tested first.

**Organization**: US1 (M1), then US2 to US5 and the release gate (M2), then extension points added by later features.

## Format: `[ID] [P?] [Story] Description`

`desktop` = `apps/desktop`, `tools` = `tools/quality`.

---

## Phase 1: Setup

- [ ] T001 Ask the owner OI-2 (search budget reading), OI-3 (reference machine) and OD-1 (`@axe-core/playwright`); record in `specs/016-quality-nfr/research.md`
- [ ] T002 Create the dev-only package `tools/quality` (not a dependency of any shipped package) and add it to `pnpm-workspace.yaml`; create `quality/` with `budgets.json` from research D2 and an empty `rules-register.md`

---

## Phase 2: User Story 1 - Speed budgets are measured (M1, 21 to 27 Dec 2026; P1)

- [ ] T003 [P] [US1] Write tests in `tools/quality/tests/percentile.test.ts` and `budget.test.ts`: p50 and p95 of known samples; within or outside budget; a miss with an accepted note passes the gate, without one fails
- [ ] T004 [P] [US1] Write tests in `tools/quality/tests/dataset.test.ts`: the same seed gives byte-identical masters; the release profile has 50,000 variants and 2 years of 500 bills a day; messy cases present (duplicates, 120-character names, Hindi names, no cost, negative stock, cancelled and edited bills, returns)
- [ ] T005 [US1] Implement `tools/quality/src/percentile.ts`, `budget.ts` and `dataset/` (writes through the desktop repositories and services in a Node script run with `ELECTRON_RUN_AS_NODE=1`) to pass T003 and T004; `pnpm quality:dataset`
- [ ] T006 [US1] Implement bench mode in `desktop/src/main/bench/` (refuses the real user-data folder; copies the dataset with the online backup API; runs search, bill save, save and print to PDF, daily report when 011 exists, start-up; records machine details) and `pnpm quality:bench`
- [ ] T007 [US1] Run the release and scale profiles on the reference machine; commit the run files under `quality/runs/` and record size and time (OI-1)

---

## Phase 3: User Story 2 - Offline and no-lost-bill testing (M2, 28 to 29 Dec; P1)

- [ ] T008 [US2] Implement `pnpm quality:offline` in `tools/quality/src/offline/`: packaged run with the network denied (macOS sandbox profile from 001; Windows and Linux method from OI-4), 50 kill-during-save runs checking bill, lines, tenders and movements are complete or absent, and the double-submit test
- [ ] T009 [US2] Create the GitHub label `bill-integrity` and a check in the release gate that fails when any open issue has it

---

## Phase 4: User Story 3 - Backup, restore and reliability (M2, 30 Dec; P1)

- [ ] T010 [P] [US3] Write tests in `desktop/src/main/services/backup/verifyBackup.test.ts` (before code): a good backup passes integrity and count checks and sets `verified_at`; a truncated or corrupted file sets `verify_error`; verification opens the file read-only and never changes it
- [ ] T011 [US3] Add `backup_log.verified_at` and `verify_error` (migration marked additive) and run verification after every backup in `desktop/src/main/services/BackupService.ts` to pass T010; show unverified backups in 015's health check when it exists
- [ ] T012 [US3] Add `quality/drills/` with a restore-drill template; record the first drill by someone other than the builder (SC-003)

---

## Phase 5: User Story 4 - Security and privacy checks (M2, 31 Dec; P1)

- [ ] T013 [US4] Implement `pnpm quality:security` in `tools/quality/src/security/`: PIN scan over every text column and the log folder for a known test PIN (after 005), `pnpm audit --prod` failing on high or critical, and hooks for 018's checks and 010's HTTPS check
- [ ] T014 [US4] Add a breach tabletop drill template to `quality/drills/` (run yearly after 010's breach plan exists)

---

## Phase 6: User Story 5 - Learnability, accessibility, language and traceability (M2, 1 to 2 Jan 2027; P2)

- [ ] T015 [P] [US5] Add `@axe-core/playwright` (if OD-1 approves) and write `desktop/tests/a11y/screens.spec.ts`: every screen in light and dark has no serious or critical violation; counter buttons at least 44 by 44 px
- [ ] T016 [P] [US5] Write `desktop/tests/print/layouts.spec.ts`: bill layouts at 58 mm, 80 mm, A4 and A5 rendered to PDF and compared with approved snapshots
- [ ] T017 [US5] Write `desktop/tests/integration/rulesWithoutRelease.test.ts`: changing a setting (a discount limit after 005, a GST rate after 008) applies on the next action without a restart; list each rule in `quality/rules-register.md`

---

## Phase 7: Release gate (M2, 3 Jan 2027)

- [ ] T018 Implement `pnpm quality:release-record <version>` and the template in `tools/quality/src/release/`
- [ ] T019 Add `.github/workflows/release-gate.yml` (tags `v*`): tests, e2e, `quality:offline`, `quality:print-snapshots`, `quality:a11y`, `quality:security`, a benchmark result for the version within 14 days, a complete release record, zero `bill-integrity` issues
- [ ] T020 Run quickstart 6 for the first tagged release and commit `quality/releases/<version>.md`

---

## Extension points (added by later features; each listed in that feature's tasks)

- [ ] T021 002: add the 50,000-variant search measure with typos and Hindi names to bench mode (002 T025 uses this harness)
- [ ] T022 005: switch on the PIN scan with a seeded test user
- [ ] T023 008: rate change without a release in `rulesWithoutRelease.test.ts`
- [ ] T024 010: add `pnpm test:sync-sim` to `quality:offline`, the Today card measure (NFR-003), the HTTPS-only check, the revoke test and availability from the uptime monitor (NFR-007); SC-005 sync health from the server
- [ ] T025 011: add the daily sales report measure
- [ ] T026 012: link training results (NFR-010, SC-006) into the release record
- [ ] T027 014: add the format scan and `pnpm text:check` to the release gate
- [ ] T028 015: add save-and-print to the real printer to bench mode
- [ ] T029 018: add the hardening checks to `quality:security`

---

## Dependencies and execution order

```
Setup --> US1 (dataset, bench) --> US2, US3, US4, US5 (parallel) --> Release gate --> extension points as features land
```

## Parallel examples

- US1: T003 and T004 together.
- M2: T008, T010, T013, T015, T016 together.

## Implementation strategy

Measure first (M1), then make failures block releases (M2). Each later feature adds its own measure or check to the same routine instead of inventing another.
