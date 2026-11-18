---
description: "Task list for feature 006: delivery"
---

# Tasks: Delivery

**Input**: Design documents from `/specs/006-delivery/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, contracts/challan-layout.md, quickstart.md. Features 003, 004, 005 and 008 merged.

**Tests**: Included and written first (bill lines, tenders and cash entries are written).

**Organization**: US1 to US3 (P1). US4 (partial delivery, driver phone view) is V2 and **not planned**.

## Format: `[ID] [P?] [Story] Description`

`core` = `packages/core`, `desktop` = `apps/desktop`.

---

## Phase 1: Setup

- [ ] T001 Ask the owner OI-2 (areas and bands) and OI-3 (prices on the default challan) and ask the CA OI-1 (e-way bill); record answers in `specs/006-delivery/research.md`
- [ ] T002 [P] Create `core/src/delivery/` with an `index.ts` barrel exported from `core/src/index.ts`

---

## Phase 2: Foundational

- [ ] T003 [P] Write tests in `core/tests/delivery/deliveryStatus.test.ts`: pending to out_for_delivery needs driver and vehicle; out_for_delivery to delivered needs proof; failed needs a reason; failed to rescheduled needs a date; failed to closed_returned needs a return id; every other move refused; current status is the latest event
- [ ] T004 [P] Write tests in `core/tests/delivery/deliveryCharge.test.ts` and `driverCash.test.ts`: Old City ₹100, waived gives 0; Ramesh collected ₹4,250 and handed in ₹4,000 gives short ₹250; UPI collections are not counted as cash to hand in
- [ ] T005 [P] Write tests in `core/tests/delivery/challanVersion.test.ts`: current version 2 and challan version 1 gives "changed"
- [ ] T006 Implement `core/src/delivery/*.ts` to pass T003 to T005
- [ ] T007 Add `delivery` (fields and limits of `data-model.md`; `UNIQUE(shop_id, bill_no)`), `delivery_event` (append-only; reason required for `failed`; driver and vehicle required for `out_for_delivery`), `delivery_proof` (append-only; photo or signature required), `delivery_rate`, `driver`, `vehicle`, `challan`, `challan_print` (append-only), `driver_handover` (append-only) to `desktop/src/main/db/schema.ts` and generate the migration
- [ ] T008 Add lookup rows and columns (002 research D17: enum values are INSERTs into lookup tables, never table rebuilds): `item_family.kind` `service`; `bill_tender.mode` `cod` and status `pending_collection`; `tender_resolution.kind` `collected` with `driver_id`, `collected_mode`, `reference`; `cash_entry.kind` `driver_handover`; `unmet_demand.reason` and `value_paise`; `number_series.doc_kind` `challan`; seed the "Delivery charge" service item and the permissions `delivery.waive` and `delivery.dispatch`
- [ ] T009 Make stock folding and movement writers skip `service` variants in `core/src/stock.ts` and `desktop/src/main/services/billing/SaveBill.ts`, with tests in `core/tests/stock.test.ts`
- [ ] T010 Write `desktop/tests/integration/migrations006.test.ts`: migrations on a database with all earlier features; nothing existing changes; append-only triggers hold

---

## Phase 3: User Story 1 - Mark a bill for delivery with a charge and challan (P1) MVP

- [ ] T011 [P] [US1] Write tests in `desktop/tests/integration/billWithDelivery.test.ts`: `bills.save` with `delivery` writes the bill with the charge line, the delivery and a `pending` event in one transaction; waive by a Counter user needs an approval; waive is audited with the amount; another state under composition gives `INTER_STATE_UNDER_COMPOSITION` and writes nothing; `delivery.markAfterSave` adds no bill line
- [ ] T012 [P] [US1] Write tests in `desktop/src/main/services/delivery/ChallanService.test.ts`: challan number `DC{counter}/{fy}/{seq5}`; prints logged; second print `is_duplicate`; version recorded
- [ ] T013 [US1] Implement `desktop/src/main/repositories/DeliveryRepository.ts`, `desktop/src/main/services/delivery/DeliveryService.ts` and the delivery part of `SaveBill.ts` to pass T011; `delivery.referInterState` writes an `unmet_demand` row with `referred_inter_state`
- [ ] T014 [US1] Implement `desktop/src/main/services/delivery/ChallanService.ts` and `challanHtml.ts` from `contracts/challan-layout.md` to pass T012
- [ ] T015 [US1] Register `bills.save` changes, `delivery.markAfterSave`, `delivery.referInterState`, `challan.*`, `deliverySetup.*` in `desktop/src/main/ipc/handlers.ts` with schemas in `core/src/commands.ts`
- [ ] T016 [P] [US1] Build `desktop/src/renderer/features/delivery/DeliveryPanel/` (on the bill: contact, address, area or band picker, state, site, date, slot, waive with the reason shown) and `DeliverySetup/` (rates, drivers, vehicles, slots)
- [ ] T017 [US1] Write the e2e spec `desktop/tests/e2e/deliveryBill.spec.ts` for quickstart 1 and time SC-002

---

## Phase 4: User Story 2 - Dispatch list and statuses (P1)

- [ ] T018 [P] [US2] Write tests in `desktop/src/main/services/delivery/DispatchService.test.ts`: assign one driver and vehicle; a second driver refused while out; dispatch, fail, reschedule, close returned each write one event and one audit entry; `closeReturned` refuses a return of another bill
- [ ] T019 [US2] Implement `desktop/src/main/services/delivery/DispatchService.ts` and `DriverRepository.ts` to pass T018; register `delivery.list`, `.get`, `.updateAddress`, `.assign`, `.dispatch`, `.fail`, `.reschedule`, `.closeReturned`
- [ ] T020 [P] [US2] Build `desktop/src/renderer/features/delivery/DispatchList/` (by date, status words and colours, driver and vehicle, "Bill changed after challan" flag, COD pending amount) and `DeliveryDetail/` (event history, actions; "Take back" opens 003's return screen for that bill)
- [ ] T021 [US2] Write the e2e spec `desktop/tests/e2e/dispatch.spec.ts` for quickstart 2

---

## Phase 5: User Story 3 - Proof of delivery and driver cash (P1)

- [ ] T022 [P] [US3] Write tests in `desktop/src/main/services/delivery/DriverCashService.test.ts`: `delivery.collect` writes one `collected` resolution per COD tender; amount must equal the tender (`AMOUNT_MISMATCH`); UPI collection checks duplicate references; `handover` writes the handover and a `driver_handover` cash entry in one transaction; `driverCash` gives collected, handed in and difference; a difference above 005's alert raises one owner exception at day close
- [ ] T023 [P] [US3] Write tests in `desktop/tests/integration/deliveryProof.test.ts`: `recordProof` copies the photo into the data folder, writes the proof and a `delivered` event; delivered without proof refused
- [ ] T024 [US3] Implement `desktop/src/main/services/delivery/DriverCashService.ts` and proof recording in `DispatchService.ts` to pass T022 and T023; add driver cash to 005's `DayCloseService` summary
- [ ] T025 [P] [US3] Build `desktop/src/renderer/features/delivery/DeliveryDetail/ProofForm/` (receiver name, photo pick, signature pad) and `DriverCash/` (collect, hand in, per-driver position)
- [ ] T026 [US3] Write the e2e spec `desktop/tests/e2e/deliveryProofCash.spec.ts` for quickstart 3

---

## Phase 6: Polish

- [ ] T027 [P] Check every delivery screen in System, Light and Dark (quickstart 4); challan prints black on white
- [ ] T028 [P] Move all new screen text into `desktop/src/renderer/strings.ts`
- [ ] T029 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`
- [ ] T030 Two-week trial: record SC-001 and SC-003 in `specs/006-delivery/plan.md`

---

## Dependencies and execution order

```
Setup --> Foundational --> US1 --> US2 --> US3 --> Polish
```

US2 needs US1's deliveries; US3 needs US2's statuses (delivered) and the COD tender from US1.

## Parallel examples

- Phase 2: T003, T004, T005 together.
- US1: T011 and T012 together.
- US3: T022 and T023 together.

## Implementation strategy

MVP slice: US1 (deliveries with charge and challan) replaces the paper delivery book; US2 and US3 follow within the same 3-week window.
