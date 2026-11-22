# Implementation Plan: Delivery

**Branch**: `006-delivery` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-delivery/spec.md`, PRD section 6 Delivery, the architecture reference sections 7.5 and 11.2, the constitution v2.1.0, and the designs of 002, 003, 004, 005 and 008.

## Summary

Let the counter mark a bill To deliver with address, contact, site, date and slot; add a delivery-charge line from area or distance-band rates (waivable with permission); print a numbered challan with or without prices; run a dispatch list where deliveries move through Pending, Out for delivery, Delivered or Failed with one driver and a vehicle; enter proof of delivery at the counter (phone later); and reconcile cash collected by drivers at day close. Status history is append-only. A failed delivery never invents a stock movement: goods come back only through 003's return or cancel.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Unchanged; no new package.

**Storage**: Same SQLite file. New tables `delivery`, `delivery_event`, `delivery_proof`, `delivery_rate`, `driver`, `vehicle`, `challan`, `challan_print`, `driver_handover`; enum values added to `item_family.kind`, `bill_tender`, `tender_resolution`, `cash_entry`, `unmet_demand`, `number_series`; proof photos in the data folder (backed up).

**Testing**: Vitest test-first for core status rules and cash positions and for every write that touches bills, tenders or cash; Playwright for the quickstart.

**Target Platform**: macOS first; Windows and Linux.

**Project Type**: desktop-app (pnpm workspace).

**Performance Goals**: Delivery created, charged and challan printed in under 90 s (SC-002); dispatch list for a day under 0.3 s at 100 deliveries.

**Constraints**: Offline; no maps or routing; proof at the counter until 010; no stock movement beyond 003's.

**Scale/Scope**: About 20 deliveries a day, 2 to 5 drivers; 5 screens or panels (delivery panel on the bill, dispatch list, delivery detail with proof, driver cash, setup).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle              | How this plan satisfies it                                                                                                                                                      | Status          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| I. Saved bill versions | Charge line added before save; marking after save adds no line (an edit is 003's version flow); challan records the version                                                     | Pass            |
| II. Immutable records  | `delivery_event`, `delivery_proof`, `challan_print`, `driver_handover` append-only; no new stock movement type (research D4); driver cash from tender resolutions and handovers | Pass            |
| III. Integers          | Charges and cash in paise                                                                                                                                                       | Pass            |
| IV. Offline-first      | Everything local; proof at the counter                                                                                                                                          | Pass            |
| V. UI-free core        | Status machine, charge, driver cash position in core                                                                                                                            | Pass            |
| VI. Test-first         | Core and the bill, tender and cash writes tested first                                                                                                                          | Pass            |
| VII. Simplicity        | US4 (V2) out; no maps; one delivery per bill                                                                                                                                    | Pass            |
| VIII to X              | Status words; both themes; challan always light                                                                                                                                 | Pass            |
| Unconfirmed facts      | E-way bill need (OI-1) open with the CA                                                                                                                                         | Pass (recorded) |

Post-design re-check (2026-11-18): no violations.

## Project Structure

### Documentation (this feature)

```text
specs/006-delivery/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
└── contracts/ipc-commands.md, contracts/challan-layout.md
```

### Source Code (repository root)

```text
packages/core/src/delivery/   # deliveryStatus.ts, deliveryCharge.ts, driverCash.ts, challanVersion.ts
apps/desktop/src/main/
├── repositories/             # DeliveryRepository, DriverRepository, ChallanRepository
├── services/delivery/        # DeliveryService, DispatchService, DriverCashService, ChallanService (+ challanHtml.ts)
└── ipc/handlers.ts
apps/desktop/src/renderer/features/delivery/
├── DeliveryPanel/ (on the bill), DispatchList/, DeliveryDetail/ (ProofForm/), DriverCash/, DeliverySetup/
```

**Structure Decision**: Same two packages; one service folder per use case group.

## Milestone Plan

Window 2 to 22 August 2027 (proposed, 002 research D16).

| #     | Dates        | Milestone                                              | Exit criteria                                      |
| ----- | ------------ | ------------------------------------------------------ | -------------------------------------------------- |
| M1    | 2 to 8 Aug   | Core, schema, bill for delivery, charge, challan (US1) | Quickstart 1; SC-002 timed; OI-2 and OI-3 answered |
| M2    | 9 to 15 Aug  | Dispatch list and statuses (US2)                       | Quickstart 2; SC-004 spot check of 20              |
| M3    | 16 to 22 Aug | Proof and driver cash (US3)                            | Quickstart 3 and 4                                 |
| Trial | 2 weeks      | Real deliveries                                        | SC-001 and SC-003 measured                         |

**Risks and fallbacks**

- Drivers do not bring photos back: receiver name and signature on the paper challan, scanned or photographed at the counter.
- OI-1 shows e-way bills are needed for some deliveries: a separate spec; deliveries above the threshold are flagged meanwhile.

## Complexity Tracking

| Addition                                     | Why it is needed                                 | Simpler alternative rejected because                    |
| -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `delivery_event` history table               | FR-009: never delete earlier states              | A status column overwritten in place loses history      |
| COD as a tender with a collection resolution | Driver cash reconciled against the bill (FR-006) | A free-text "cash collected" field cannot be reconciled |
