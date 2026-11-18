---
description: "Task list for feature 007 (MVP part): stock by location, opening counts, adjustments"
---

# Tasks: Stock by Location, Counts and Adjustments (MVP part of feature 007)

**Input**: Design documents from `/specs/007-stock-locations-rolls/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, quickstart.md. Features 002, 003 and 005 merged.

**Tests**: Included and written first (constitution VI: stock movements).

**Organization**: US1 to US3 (P1). US4, US5 and US6 are V2, V3 or Later and **not planned**; they get their own revision of this feature when V2 starts.

## Format: `[ID] [P?] [Story] Description`

`core` = `packages/core`, `desktop` = `apps/desktop`.

---

## Phase 1: Setup

- [ ] T001 Ask the owner OD-1 (racks as stock places) and OI-1 (rack names per location) and record them in `specs/007-stock-locations-rolls/research.md`
- [ ] T002 [P] Create `core/src/stock/`, move `core/src/stock.ts` into it as `movements.ts` and re-export from `core/src/index.ts` so existing imports keep working

---

## Phase 2: Foundational (M1, 5 to 11 Jul 2027)

### Core rules, tests first

- [ ] T003 [P] Write tests in `core/tests/stock/balances.test.ts`: a transfer gives -qty at `from` and +qty at `to` and leaves the total unchanged; `balanceAt` counts only movements with `occurred_at <= at`; a property test of 2,000 random movements where every per-location balance equals the sum and the total equals the sum of locations
- [ ] T004 [P] Write tests in `core/tests/stock/countCorrection.test.ts`: book 40, counted 37 gives -3; counted equals book gives no movement; a later recount line in the same session supersedes the earlier one
- [ ] T005 [P] Write tests in `core/tests/stock/saleLocation.test.ts` and `locationTree.test.ts`: home R3 inside Shop floor is used; home G1 (Godown) with sale location Shop floor falls back to Shop floor; depth limit 3; subtree sum of Shop floor equals R1 to R5 plus Shop floor itself
- [ ] T006 [P] Write tests in `core/tests/stock/adjustmentApproval.test.ts`: value = quantity x cost rounded half up; above the threshold needs approval; no cost known gives value 0 and a "cost unknown" flag (approval asked when the quantity is above a quantity fallback setting)
- [ ] T007 Implement `core/src/stock/*.ts` to pass T003 to T006

### Schema and single writer

- [ ] T008 Add `location.parent_id` (depth at most 3, not itself), widen `location.kind` (`shop_floor`, `godown`, `defective`, `tinted_returns`, `rack`, `other`), add `is_active`, seed Godown and Defective if missing; add `stock_balance` (`UNIQUE(variant_id, location_id)`), `count_session`, `count_line` (append-only), `counter_setting`, `item_variant.home_location_id` and reserved `is_sold_from_rolls` to `desktop/src/main/db/schema.ts`; generate the migration
- [ ] T009 Rebuild `stock_movement` in a hand-edited migration in `desktop/drizzle/`: types add `transfer`, `damage`, `count_correction` and reserve `transfer_out`, `transfer_in`; CHECK both locations for `transfer` and `damage` and exactly one for the rest; `reason_code` list; reason required for `adjustment` and `damage`; note required for `other`; `approval_id`; reserved `roll_id`; `doc_type` adds `count_session`; copy every row; re-create the append-only triggers. Existing `adjustment` rows get `reason_code = 'other'` (their note is kept)
- [ ] T010 Fill `stock_balance` from movements in the same migration and set `first_counted_at` from each variant's earliest `opening` movement; test in `desktop/tests/integration/migrations007.test.ts` that every balance equals the sum and every 001 to 006 test still passes
- [ ] T011 Write tests in `desktop/src/main/services/stock/MovementService.test.ts`: `record` writes the movement, updates `stock_balance` and `item_variant.stock_milli`, and raises or resolves the `negative_stock` exception, all in the caller's transaction; a failure rolls back all of it
- [ ] T012 Implement `desktop/src/main/services/stock/MovementService.ts` and `desktop/src/main/repositories/StockBalanceRepository.ts` to pass T011
- [ ] T013 Route every existing movement writer through `MovementService`: `InventoryService` (opening, adjustment), `SaveBill` and `CancelBill` (sale, sale_cancel, edit_reverse, colorants), `ReturnService` (sale_return), `MergeService` (merge_in, merge_out); one PR per caller with its tests green
- [ ] T014 Implement `desktop/src/main/services/stock/StockVerifier.ts` (`stock.verify` at start in the background and nightly) with tests that a corrupted balance is found, logged as an exception and rebuilt from movements

**Checkpoint (M1 exit)**: one writer of movements; balances per location verified.

---

## Phase 3: User Story 1 - Stock movements by location (M2, 12 to 18 Jul; P1) MVP

**Independent Test**: quickstart 1.

- [ ] T015 [P] [US1] Write tests in `desktop/src/main/services/stock/LocationService.test.ts`: create rack R3 under Shop floor and "Godown 2"; duplicate sibling name refused; deactivating a location with stock gives `LOCATION_HAS_STOCK`; seeded locations cannot be deactivated
- [ ] T016 [P] [US1] Write tests in `desktop/tests/integration/transferDamage.test.ts`: transfer 10 Godown to R3 writes one movement and changes two balances; `SAME_LOCATION`; damage 2 from R3 goes to Defective with a reason; idempotent by `clientMovementId`
- [ ] T017 [P] [US1] Write tests in `desktop/tests/integration/saleFromHome.test.ts`: a sale with home R3 takes stock from R3; cancel returns it to R3; a variant with no home sells from the counter's sale location
- [ ] T018 [US1] Implement `desktop/src/main/services/stock/LocationService.ts`, `desktop/src/main/repositories/LocationRepository.ts`, `stock.transfer`, `stock.damage`, `stock.setHomeLocation`, `stock.lookup`, `locations.*`, `counters.setSaleLocation` to pass T015 and T016
- [ ] T019 [US1] Use `chooseSaleLocation` in `SaveBill.ts` and `CancelBill.ts` to pass T017
- [ ] T020 [P] [US1] Build `desktop/src/renderer/features/stock/Locations/` (tree, add rack or location) and `StockLookup/` (per location with "Uncounted", total, last purchase price, last sale date)
- [ ] T021 [P] [US1] Build `desktop/src/renderer/features/stock/TransferDialog/` and `DamageDialog/` (from, to, quantity in any defined unit using 002's conversions)
- [ ] T022 [US1] Write the e2e spec `desktop/tests/e2e/stockLocations.spec.ts` for quickstart 1

---

## Phase 4: User Story 2 - Opening stock by rack (M3, 19 to 25 Jul; P1)

**Independent Test**: quickstart 2.

- [ ] T023 [P] [US2] Write tests in `desktop/src/main/services/stock/CountService.test.ts`: one open session per location; record lines by scan or search; `markDone` posts `count_correction` movements at each line's `counted_at` (doc = the session) and closes the session in one transaction; a sale between count and posting is kept; `first_counted_at` set; first count on a rack sets the variant's home location when it has none; after the go-live date, a correction above the threshold needs an approval
- [ ] T024 [US2] Implement `desktop/src/main/services/stock/CountService.ts` and `desktop/src/main/repositories/CountRepository.ts` to pass T023; register `counts.*`
- [ ] T025 [P] [US2] Build `desktop/src/renderer/features/stock/RackCount/` (pick rack, scan or search, quantity pad, counted list with differences, "Mark rack done", progress "3 of 40 racks"), keyboard and scanner first
- [ ] T026 [US2] Write the e2e spec `desktop/tests/e2e/rackCount.spec.ts` for quickstart 2 and time SC-002 with 25 items

---

## Phase 5: User Story 3 - Adjustments and negative stock (M4, 26 Jul to 1 Aug; P1)

**Independent Test**: quickstart 3.

- [ ] T027 [P] [US3] Write tests in `desktop/tests/integration/adjustments007.test.ts`: `stock.adjust` needs `stock.adjust` permission and a reason from the list; `other` needs a note; above the value threshold `APPROVAL_REQUIRED`, and with an approval it is consumed in the movement transaction
- [ ] T028 [P] [US3] Write tests in `desktop/tests/integration/negativeStock.test.ts`: a sale below zero saves and opens one `negative_stock` exception per variant and location; a second sale does not open a second; stock back to zero or above resolves it
- [ ] T029 [US3] Extend `stock.adjust` in `desktop/src/main/services/InventoryService.ts` (moved to `desktop/src/main/services/stock/AdjustmentService.ts`) to pass T027; `stock.negativeList` to pass T028
- [ ] T030 [P] [US3] Build `desktop/src/renderer/features/stock/Adjustments/` (location, quantity, reason list, note, approval prompt from 005) and `NegativeStock/` (list with "Negative" as a word, open lookup, adjust or count)
- [ ] T031 [US3] Write the e2e spec `desktop/tests/e2e/adjustments.spec.ts` for quickstart 3

---

## Phase 6: Polish

- [ ] T032 [P] Check every stock screen in System, Light and Dark (quickstart 4)
- [ ] T033 [P] Move all new screen text into `desktop/src/renderer/strings.ts`
- [ ] T034 Update `specs/001-shop-os-mvp/data-model.md` "Target shape" to point to this feature for locations and movement types
- [ ] T035 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`
- [ ] T036 After go-live, count one rack a day (PRD go-live table) and record SC-001 at day 60 in `specs/007-stock-locations-rolls/plan.md`

---

## Dependencies and execution order

```
Setup --> Foundational (single writer, balances) --> US1 --> US2 --> US3 --> Polish
```

US2 needs US1's racks; US3 is independent of US2 after the foundation.

## Parallel examples

- Phase 2: T003 to T006 together.
- US1: T015, T016, T017 together; T020 and T021 together.
- US3: T027 and T028 together.

## Implementation strategy

The foundation (one writer, verified balances) is the risky part and comes first in its own PRs; US1 to US3 are then small slices used at the counter one after another.
