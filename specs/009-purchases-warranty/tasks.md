---
description: "Task list for feature 009: purchases, distributors, price history, debit notes, warranty register"
---

# Tasks: Purchases, Distributors and Warranty Register

**Input**: Design documents from `/specs/009-purchases-warranty/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, quickstart.md. Features 002, 003, 004, 005, 007 and 008 merged.

**Tests**: Included and written first (constitution VI: stock movements and ledger entries).

**Organization**: US1, US2, US3 (P1), US4 (P2), then the FR-010 warranty register data from US5. US5's cases and claims and US6 are V3 or Later and **not planned**.

## Format: `[ID] [P?] [Story] Description`

`core` = `packages/core`, `desktop` = `apps/desktop`.

---

## Phase 1: Setup

- [ ] T001 Ask the owner OD-1 (serial capture in 003) and OI-1, OI-3; ask the CA OI-4; check OI-2 against the BIS list; record answers in `specs/009-purchases-warranty/research.md`
- [ ] T002 [P] Create `core/src/purchasing/` and `core/src/warranty/` with barrels exported from `core/src/index.ts`

---

## Phase 2: Foundational (M1, 4 to 10 Oct 2027)

- [ ] T003 [P] Write tests in `core/tests/purchasing/allocateCharges.test.ts`: ₹600 freight by value on ₹6,000, ₹3,000, ₹1,000 gives ₹360, ₹180, ₹60; by quantity on 100, 50, 10 gives ₹375.00, ₹187.50, ₹37.50; ₹1.00 by value on three equal lines gives 33, 33 and 34 paise with the remainder on the largest (first) line so the sum is exact; several charges with different bases; a property test that shares always sum to the charges
- [ ] T004 [P] Write tests in `core/tests/purchasing/landedCost.test.ts` and `lineQuantities.test.ts`: 100 units, ₹6,000 + ₹360 gives ₹63.60 per unit; invoiced 20, received 18, damaged 3 gives good 15, short 2; excess when received above invoiced; damaged above received refused
- [ ] T005 [P] Write tests in `core/tests/purchasing/priceAlert.test.ts` and `sellingPriceSuggestion.test.ts`: ₹63 after ₹60 at 2% gives an alert of 5.0%; ₹61 does not; no earlier price from the distributor uses any distributor's last; ₹63.00 at 20% suggests ₹79
- [ ] T006 [P] Write tests in `core/tests/purchasing/payables.test.ts` and `debitNoteStatus.test.ts`: due date = invoice date + credit days; due this week = open bills due in the next 7 days; statuses only move one step forward
- [ ] T007 [P] Write tests in `core/tests/warranty/warrantyEnd.test.ts`: sold 31 Jan plus 1 month ends 28 or 29 Feb (end of month rule, using Luxon from 001 D25)
- [ ] T008 Implement `core/src/purchasing/*.ts` and `core/src/warranty/*.ts` to pass T003 to T007
- [ ] T009 Add the tables of `data-model.md` to `desktop/src/main/db/schema.ts` (receipt status trigger blocking changes after `posted`; append-only triggers on bills, links, price history, returns, debit notes and events, serials; `UNIQUE(party_id, supplier_invoice_no, financial_year)` for non-cash bills; unique `receipt_id` in `purchase_bill_receipt`) and generate the migration
- [ ] T010 Insert the lookup rows of `data-model.md` (movement types `purchase` and `purchase_return`, document types, ledger entry types with their signs, `cash_purchase`, exception kinds, document kinds) with no table rebuild (002 research D17), and add `payment.direction` `out`; test that the migration is additive (012 D10); add `category.target_margin_bp` and `requires_isi`; seed the permission `payment.pay`
- [ ] T011 Write `desktop/tests/integration/migrations009.test.ts`: migrations on a database with all earlier features; nothing existing changes; triggers hold

---

## Phase 3: User Story 1 - Goods receipt with landed cost (M2, 11 to 17 Oct; P1) MVP

- [ ] T012 [P] [US1] Write tests in `desktop/src/main/services/purchasing/ReceiptService.test.ts`: draft saves and recomputes the preview; posting in one transaction writes the number, good stock to the location and damaged stock to Defective through `MovementService`, batches with MRP and landed cost, price history, compliance records, exceptions (missing ISI, duplicate supplier invoice), the variant's new purchase price and an audit entry; idempotent by `clientReceiptId`; posted receipts reject changes
- [ ] T013 [US1] Implement `desktop/src/main/repositories/ReceiptRepository.ts` and `desktop/src/main/services/purchasing/ReceiptService.ts` to pass T012; register `receipts.*`
- [ ] T014 [P] [US1] Build `desktop/src/renderer/features/purchasing/ReceiptEntry/` with `LineGrid/` (scan or search, entered unit, invoiced, received, damaged, price, batch, MRP, GST, ISI), `ChargesPanel/` and `PostPreview/` (shares, landed cost, warnings)
- [ ] T015 [US1] Write the e2e spec `desktop/tests/e2e/goodsReceipt.spec.ts` for quickstart 1; time SC-001; reconcile 20 real receipts for SC-002 and record the result in `specs/009-purchases-warranty/plan.md`

---

## Phase 4: User Story 2 - Purchase bill and distributor ledger (M3, 18 to 24 Oct; P1)

- [ ] T016 [P] [US2] Write tests in `desktop/src/main/services/purchasing/PurchaseBillService.test.ts`: a bill linked to two receipts posts one negative `purchase_bill` entry and the due date; a receipt billed twice refused; a total that does not add up refused; mismatch with receipt lines reported; unbilled cash purchase writes the bill, a `payment_out` in cash and a `cash_purchase` cash entry in one transaction and raises an exception
- [ ] T017 [P] [US2] Write tests in `desktop/src/main/services/purchasing/PayablesService.test.ts`: `payments.pay` allocates oldest first to purchase bills (negative entries, allocated with 004's absolute bounds: a ₹5,000 payment against bills of -₹3,000 and -₹4,000 settles the first and ₹2,000 of the second); ageing of payables; due this week; 004's `ledger.verify` passes for distributors (SC-004)
- [ ] T018 [US2] Implement `PurchaseBillService.ts`, `PayablesService.ts` and `PurchaseBillRepository.ts` to pass T016 and T017 (reuse 004's `LedgerService` and allocation); register `purchaseBills.*`, `payables.*`, `payments.pay`
- [ ] T019 [P] [US2] Build `desktop/src/renderer/features/purchasing/PurchaseBill/` (pick receipts, invoice totals, mismatch shown) and `Payables/` (per distributor, ageing, due this week, pay)
- [ ] T020 [US2] Write the e2e spec `desktop/tests/e2e/purchaseBills.spec.ts` for quickstart 2

---

## Phase 5: User Story 3 - Price history and alerts (M4, 25 to 31 Oct; P1)

- [ ] T021 [P] [US3] Write tests in `desktop/src/main/services/purchasing/PriceInsightService.test.ts`: alerts raised at posting for rises above the setting; suggestion from the category's target margin; accepting it calls 002's price command and is audited; comparison gives last, average, delivery days (proxy) and short-supply rate per distributor
- [ ] T022 [US3] Implement `PriceInsightService.ts` and `PriceHistoryRepository.ts` to pass T021; register `prices.*`
- [ ] T023 [P] [US3] Build `desktop/src/renderer/features/purchasing/PriceInsight/` (price history as a Radix table, distributor comparison table, accept suggestion) and show rise alerts in `PostPreview/`
- [ ] T024 [US3] Write the e2e spec `desktop/tests/e2e/priceInsight.spec.ts` for quickstart 3 and the 20-receipt check for SC-003

---

## Phase 6: User Story 4 - Purchase returns and debit notes (M5, 1 to 4 Nov; P2)

- [ ] T025 [P] [US4] Write tests in `desktop/src/main/services/purchasing/PurchaseReturnService.test.ts`: return from Defective writes `purchase_return` movements, a debit note number, a positive `debit_note` entry and a `raised` event in one transaction; short-only lines move no stock; returning more than received refused; `debitNotes.advance` moves one step and logs user and time; settled cannot advance
- [ ] T026 [US4] Implement `PurchaseReturnService.ts` and `PurchaseReturnRepository.ts` to pass T025; register `purchaseReturns.*`, `debitNotes.*`; debit note print layout `desktop/src/main/services/purchasing/debitNoteHtml.ts`
- [ ] T027 [P] [US4] Build `desktop/src/renderer/features/purchasing/PurchaseReturn/` (from a receipt, lines, reason; debit note status timeline)
- [ ] T028 [US4] Write the e2e spec `desktop/tests/e2e/purchaseReturns.spec.ts` for quickstart 4

---

## Phase 7: User Story 5 (FR-010 data only) - Warranty register (M5, 5 to 7 Nov; V3 data from MVP)

- [ ] T029 [P] [US5] Write tests in `desktop/tests/integration/warrantyRegister.test.ts`: a serial-tracked line needs as many serials as whole units (`SERIALS_REQUIRED`); the bill transaction writes `bill_line_serial` rows and `warranty_register` rows with the end date; cancel removes them; rebuild from bill lines equals the incremental table
- [ ] T030 [US5] Add serial capture to 003's `SaveBill.ts` and a serial prompt to the bill screen in `desktop/src/renderer/features/billing/SerialPrompt/`; implement `desktop/src/main/services/warranty/WarrantyRegisterService.ts` to pass T029 (skip if OD-1 moved this into 003)
- [ ] T031 [P] [US5] Build `desktop/src/renderer/features/warranty/WarrantyLookup/` (by serial, bill number or phone; "In warranty until" or "Out of warranty since")
- [ ] T032 [US5] Write the e2e spec `desktop/tests/e2e/warrantyRegister.spec.ts` for quickstart 5

---

## Phase 8: Polish

- [ ] T033 [P] Check every new screen in System, Light and Dark (quickstart 6); debit notes print black on white
- [ ] T034 [P] Move all new screen text into `desktop/src/renderer/strings.ts`
- [ ] T035 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`

---

## Dependencies and execution order

```
Setup --> Foundational --> US1 --> US2 --> US3 --> US4 --> US5 (data) --> Polish
```

US2 needs posted receipts; US3 needs price history written at posting (US1); US4 needs posted receipts and the ledger (US2). US5's data part is independent after the foundation and can move into 003 (OD-1).

## Parallel examples

- Phase 2: T003 to T007 together.
- US2: T016 and T017 together.

## Implementation strategy

US1 first: correct landed cost is the base of margin and the below-cost guard. US2 makes payables visible; US3 protects margin; US4 recovers money for damaged and short goods.
