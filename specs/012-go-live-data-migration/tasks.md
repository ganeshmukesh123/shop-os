---
description: "Task list for feature 012: go-live tools, training mode, reconciliation, gates, releases"
---

# Tasks: Go-Live, Data Migration and Release Practice

**Input**: Design documents from `/specs/012-go-live-data-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, quickstart.md. Features 002, 004, 005 and 007 merged.

**Tests**: Included and written first for the back-fill bill write, training isolation and every figure.

**Organization**: US1 and US5 (M1), US2 (M2), US3 and US4 (M3).

## Format: `[ID] [P?] [Story] Description`

`core` = `packages/core`, `desktop` = `apps/desktop`.

---

## Phase 1: Setup

- [ ] T001 Confirm 002's OD-1 (item import in 002); if declined, move 002 tasks T070 to T076 into this feature and note it in `specs/012-go-live-data-migration/plan.md`
- [ ] T002 [P] Create `core/src/golive/` with an `index.ts` barrel exported from `core/src/index.ts`
- [ ] T003 Ask the CA OI-1 and the owner OI-3 and OI-4; record answers in `specs/012-go-live-data-migration/research.md`

---

## Phase 2: Foundational

- [ ] T004 [P] Write tests in `core/tests/golive/readiness.test.ts`: 512 items with 3 missing units and 96 of 100 parties gives "Not ready" with both gaps; 500 items, all parties, no open duplicates, sign-off and training complete gives "Ready"
- [ ] T005 [P] Write tests in `core/tests/golive/shareBilled.test.ts`, `bypassSignals.test.ts`, `top200Accuracy.test.ts`, `trainingSeries.test.ts`: ₹38,200 / ₹40,000 = 9550 bp; bills per footfall over 14 days; 19 of 20 within tolerance gives 9500 bp; `trainingTemplate` turns `C1/26-27/000123` into `TR/26-27/000123` (15 characters) and never makes a number longer than the live one
- [ ] T006 Implement `core/src/golive/*.ts` to pass T004 and T005
- [ ] T007 Add `readiness_input`, `signoff_item` (seeded six), `training_record` (one champion per shop), `daily_reconciliation` (append-only), `gate_review` (append-only), `feature_switch`, `release_marker`, `bill.paper_bill_ref` and `number_series.doc_kind` value `paper_backfill` to `desktop/src/main/db/schema.ts`; generate the migration (marked additive)

---

## Phase 3: User Story 1 - Load the shop's data before go-live (M1, 23 to 26 Aug; P1)

- [ ] T008 [P] [US1] Write tests in `desktop/src/main/golive/ReadinessService.test.ts`: counts from items, parties with opening balances, items missing price or unit, open duplicate groups (002's `exception_event` of kind `duplicate_suspect` and import duplicate groups), sign-off and training state
- [ ] T009 [US1] Implement `desktop/src/main/golive/ReadinessService.ts` to pass T008; register `golive.readiness` and `golive.setReadinessInput`
- [ ] T010 [P] [US1] Build `desktop/src/renderer/features/golive/Readiness/` (status as a word, gaps with "Fix" links to the item list, import screens and 002's merge dialog)
- [ ] T011 [US1] Write the e2e spec `desktop/tests/e2e/readiness.spec.ts` for quickstart 1

---

## Phase 4: User Story 5 - Safe releases and rollback (M1, 27 to 29 Aug; P1)

- [ ] T012 [US5] Test OI-2: build version N and N+1 (N+1 with one additive migration), open N+1's database with N, and record what 001's `migrateValidated` and start-up safety do in `specs/012-go-live-data-migration/research.md`
- [ ] T013 [US5] Write tests in `desktop/tests/integration/additiveMigrations.test.ts` and change the start-up check in `desktop/src/main/db/startupSafety.ts` so an older app opens a database with unknown newer migrations only when every unknown one is marked `-- additive: true`; otherwise it refuses with "This data was upgraded by a newer version; restore the pre-upgrade backup"
- [ ] T014 [US5] Label the pre-migration backup with the app version and write a `release_marker` row at the first start of a new version in `desktop/src/main/golive/ReleaseMarker.ts`, with a test
- [ ] T015 [P] [US5] Write tests in `desktop/src/main/golive/FeatureSwitchService.test.ts`: switches off by default; switching on needs a walkthrough date and attendees; entry points of a switched-off feature return `FEATURE_OFF`; changes audited
- [ ] T016 [US5] Implement `FeatureSwitchService.ts` to pass T015 and register a switch for each feature merged after go-live; build `desktop/src/renderer/features/golive/FeatureSwitches/`
- [ ] T017 [US5] Write `docs/operations/release-checklist.md` (research D10) and add the restore-drill step to the restore guide

---

## Phase 5: User Story 2 - Settings sign-off and training (M2, 30 Aug to 5 Sep; P1)

- [ ] T018 [P] [US2] Write tests in `desktop/src/main/golive/TrainingModeService.test.ts`: entering copies the live file with the online backup API, marks it training, swaps every series' counter code for `TR` and disables sync and cloud backup; bills saved in training never change the live file (compare checksums and row counts); leaving reopens the live file; reset remakes the copy
- [ ] T019 [US2] Implement `desktop/src/main/golive/TrainingModeService.ts` to pass T018; register `training.*`
- [ ] T020 [P] [US2] Build `desktop/src/renderer/features/golive/Training/` with `TrainingBanner/` (fixed "TRAINING" word and colour on every screen in both themes), training records and champion
- [ ] T021 [P] [US2] Build `desktop/src/renderer/features/golive/Signoff/`; register `golive.signoff.*`
- [ ] T022 [US2] Write the e2e spec `desktop/tests/e2e/training.spec.ts` for quickstart 2

---

## Phase 6: User Story 3 - Parallel run and daily total check (M3, 6 to 9 Sep; P1)

- [ ] T023 [P] [US3] Write tests in `desktop/tests/integration/backfillPaper.test.ts` (bill-writing, before code): `bills.backfillPaper` saves a bill whose number is the paper number, with stock, ledger and cash entries like any bill, in one transaction; a repeated paper number gives `DUPLICATE_BILL_NO`; a number over 16 characters is refused; a different business day gives `NOT_SAME_DAY`; idempotent by `clientBillId`
- [ ] T024 [US3] Implement `desktop/src/main/services/billing/BackfillPaperBill.ts` to pass T023 and print "Back-filled from paper bill <number>" on its copy
- [ ] T025 [P] [US3] Write tests in `desktop/src/main/golive/ReconciliationService.test.ts`: day figures from bills and 005's cash close; difference stored; a later entry for the same date supersedes in reads; non-zero differences listed as exceptions with the date
- [ ] T026 [US3] Implement `ReconciliationService.ts` to pass T025; register `reconcile.*`
- [ ] T027 [P] [US3] Build `desktop/src/renderer/features/golive/Reconciliation/` (evening entry, share against 95%, 14-day bypass view)
- [ ] T028 [US3] Write the e2e spec `desktop/tests/e2e/parallelRun.spec.ts` for quickstart 3

---

## Phase 7: User Story 4 - Gates and stock accuracy (M3, 10 to 12 Sep; P2)

- [ ] T029 [P] [US4] Write tests in `desktop/src/main/golive/GateService.test.ts`: gate reviews append-only with up to three complaints and fix status; restore drills record duration; accuracy from 007's count lines since go-live
- [ ] T030 [US4] Implement `GateService.ts` and `accuracy.top200` to pass T029; register `gates.*`
- [ ] T031 [P] [US4] Build `desktop/src/renderer/features/golive/Gates/` (accuracy with "counted 140 of 200", gate history, "Gate 1 not passed" note on the feature-switch screen)
- [ ] T032 [US4] Write the e2e spec `desktop/tests/e2e/gates.spec.ts` for quickstart 4

---

## Phase 8: Polish and go-live

- [ ] T033 [P] Check every new screen in System, Light and Dark (quickstart 6)
- [ ] T034 [P] Move all new screen text into `desktop/src/renderer/strings.ts`
- [ ] T035 Write `docs/operations/go-live-runbook.md` from the plan's runbook table
- [ ] T036 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`
- [ ] T037 Run the go-live runbook; record SC-001 to SC-006 in `specs/012-go-live-data-migration/plan.md` over the first 60 days

---

## Dependencies and execution order

```
Setup --> Foundational --> US1 --> US5 --> US2 --> US3 --> US4 --> Polish and go-live
```

US5's release practice must be in place before the first post-go-live release; US2 needs US1's loaded data for realistic training.

## Parallel examples

- Phase 2: T004 and T005 together.
- US3: T023 and T025 together.

## Implementation strategy

Tools first (readiness, release safety), then training, then the parallel-run tools; the runbook is followed from G - 14 days.
