# Implementation Plan: Stock by Location, Counts, Reorder and Cut-Length Rolls (MVP part)

**Branch**: `007-stock-locations-rolls` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-stock-locations-rolls/spec.md`, PRD section 7, the architecture reference sections 7.6, 8.5 and 11.3, the constitution v2.1.0, and the designs of 001, 002, 003 and 005.

**Scope of this plan**: the MVP stories US1 to US3 (FR-001 to FR-007). US4 and US5 (cycle counts, reorder, dead stock, rolls) are V2, and US6 is V2, V3 or Later; they are not planned (constitution VII) and get a revision of this plan when V2 starts (October 2027 in the PRD's rollout). The schema reserves their fields (research D7).

## Summary

Turn 001's single "Shop floor" into a tree of locations (Shop floor and Godown with racks, Defective, Tinted returns, user-defined), with stock per location kept as a checked projection of the append-only movements. Add one-row transfers, damage moves to Defective, opening stock counted rack by rack with timestamped corrections and "Uncounted" status, adjustments with listed reasons, permission and owner approval above a value threshold, and a negative-stock exception list that never blocks a sale.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Unchanged; no new package.

**Storage**: Same SQLite file. `location` gains `parent_id`; `stock_movement` gets new lookup rows and nullable columns only (`approval_id`, reserved `roll_id`; 001's existing `reason_code` is reused and checked against the new lookup by trigger), no rebuild (002 research D17); new `stock_balance`, `count_session`, `count_line`, `counter_setting`; `item_variant.home_location_id`, reserved `is_sold_from_rolls`.

**Testing**: Vitest test-first for core (balances at a time, corrections, sale location) and every movement writer; a property test (random movements, every balance equals the sum); Playwright for the quickstart.

**Target Platform**: macOS first; Windows and Linux.

**Project Type**: desktop-app (pnpm workspace).

**Performance Goals**: Lookup under 50 ms; a 25-item rack counted in under 10 minutes (SC-002); `stock.verify` over 50,000 variants and 5 locations under 20 s in the background; bill save still about 1 s.

**Constraints**: Offline; sales never blocked by stock; movements append-only; corrections from counts, never edits.

**Scale/Scope**: 5 top-level locations, about 40 racks, 50,000 variants (NFR-014); 5 screens (locations, stock lookup, transfer and damage, rack count, adjustments and negative list).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle              | How this plan satisfies it                                                                                                            | Status |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Saved bill versions | Sales and cancels only choose a location; no bill changes                                                                             | Pass   |
| II. Immutable records  | Every change is a movement; `stock_balance` and `stock_milli` are caches checked against the sums (SC-005) and rebuilt from movements | Pass   |
| III. Integers          | Thousandths; adjustment value in paise                                                                                                | Pass   |
| IV. Offline-first      | All local; negative stock from offline counters surfaces after sync (010)                                                             | Pass   |
| V. UI-free core        | Balance, correction, sale-location and approval rules in core                                                                         | Pass   |
| VI. Test-first         | Core and every movement writer tested first                                                                                           | Pass   |
| VII. Simplicity        | V2, V3 and Later stories not planned; transfers as one row inside a shop (research D2)                                                | Pass   |
| VIII to X              | "Uncounted" and "Negative" as words; both themes                                                                                      | Pass   |

Post-design re-check (2026-11-18): no violations. The architecture's two-row transfer is deferred to outlet transfers (Later), recorded in research D2.

## Project Structure

### Documentation (this feature)

```text
specs/007-stock-locations-rolls/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
└── contracts/ipc-commands.md
```

### Source Code (repository root)

```text
packages/core/src/stock/      # balances.ts, countCorrection.ts, saleLocation.ts, adjustmentApproval.ts, locationTree.ts
                              # (stock.ts from 001 moves here, re-exported)
apps/desktop/src/main/
├── repositories/             # LocationRepository, StockBalanceRepository, CountRepository (StockRepository extended)
├── services/stock/           # LocationService, MovementService (only writer of movements and balances),
│                             # CountService, StockVerifier
└── ipc/handlers.ts
apps/desktop/src/renderer/features/stock/
├── Locations/, StockLookup/, TransferDialog/, DamageDialog/, RackCount/, Adjustments/, NegativeStock/
```

**Structure Decision**: `MovementService` becomes the single writer of movements and balances; billing, returns, merges and counts call it inside their own transactions, so the cache can never drift from one forgotten caller.

## Milestone Plan

Window 5 July to 1 August 2027 (proposed, 002 research D16).

| #     | Dates                | Milestone                                    | Exit criteria                                                                                                                                                                                |
| ----- | -------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1    | 5 to 11 Jul          | Core, schema, single movement writer         | Core green; movement lookup rows and columns migrated on a copy of the owner's database; every existing writer routed through `MovementService` with all tests green; OD-1 and OI-1 answered |
| M2    | 12 to 18 Jul         | Locations, transfers, damage, lookup (US1)   | Quickstart 1                                                                                                                                                                                 |
| M3    | 19 to 25 Jul         | Opening stock by rack (US2)                  | Quickstart 2; SC-002 timed; OD-2 answered                                                                                                                                                    |
| M4    | 26 Jul to 1 Aug      | Adjustments, approvals, negative stock (US3) | Quickstart 3 and 4                                                                                                                                                                           |
| After | day 60 after go-live | Accuracy                                     | SC-001 (95% of top-200 items match) measured with rack counts                                                                                                                                |

**Risks and fallbacks**

- Routing every writer through one service touches 002, 003 and 004 code: one PR per caller, each with its tests green.
- Racks as stock places confuse staff at the counter: switch to racks as labels (OD-1 fallback) with no data loss, since rack balances can be transferred to the parent.

## Complexity Tracking

| Addition                              | Why it is needed                                           | Simpler alternative rejected because                                        |
| ------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| `stock_balance` per location          | Lookup by location at 50,000 variants (FR-004)             | Summing movements per lookup is too slow; the cache is verified nightly     |
| Location tree                         | Racks inside Shop floor and Godown (FR-003, FR-005)        | Flat locations cannot show "Shop floor total"                               |
| Count corrections at the count's time | Counts during trading must not lose sales (spec edge case) | Setting stock to the counted figure at posting time would erase later sales |
