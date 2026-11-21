---
description: "Task list for feature 009: purchases, distributors, price history, debit notes, warranty register"
---

# Tasks: Purchases, Distributors and Warranty Register

**Input**: Design documents from `/specs/009-purchases-warranty/`

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:11c7a02a61d3b3d93d4a9e467950c9c924c8a5d199baa1d470b4caea3fc88cb9 -->

**Prerequisites for Phase 1 onward**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, quickstart.md. Features 002, 003, 004, 005, 007 and 008 merged. Phase 0 runs before 003 starts.

**Tests**: Included and written first (constitution VI: stock movements and ledger entries).

**Organization**: US1, US2, US3 (P1), US4 (P2), then the FR-010 warranty register data from US5. US5's cases and claims and US6 are V3 or Later and **not planned**.

## Format: `[ID] [P?] [Story] Description`

`core` = `packages/core`, `desktop` = `apps/desktop`.

---

## Phase 0: Decision before feature 003

- [ ] T000 Ask the owner OD-1 (whether to capture serials at sale in 003) and record the decision in research.md before 003 implementation starts. Block the 003 merge until the decision is recorded and any approved serial capture is implemented in 003.

## Phase 1: Setup

- [ ] T001 Ask the owner OI-1, OI-3; ask the CA OI-4; check OI-2 against the BIS list; record answers in `specs/009-purchases-warranty/research.md`
- [ ] T002 [P] Create `core/src/purchasing/` and `core/src/warranty/` with barrels exported from `core/src/index.ts`

<!-- /coderabbit-ai-generated:v1 -->

---

## Phase 2: Foundational (M1, 4 to 10 Oct 2027)

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ca00cab755f31105aecb0b425bec70bdbe05f747ff12c86846b97320744cdfc3 -->

- [ ] T003 [P] Write tests in `core/tests/purchasing/allocateCharges.test.ts`: ₹600 freight by value on ₹6,000, ₹3,000, ₹1,000 gives ₹360, ₹180, ₹60; by quantity on 100, 50, 10 gives ₹375.00, ₹187.50, ₹37.50; ₹1.00 by value on three equal lines gives 34, 33 and 33 paise, with the tied remainder going to the first line and the shares summing to ₹1.00; bases 6, 5 and 4 with a 2-paise charge give 1, 1 and 0 paise; several charges with different bases; a property test that shares always sum to the charges
- [ ] T004 [P] Write tests in `core/tests/purchasing/landedCost.test.ts` and `lineQuantities.test.ts`: 100 units, ₹6,000 + ₹360 gives ₹63.60 per unit; invoiced 20, received 18, damaged 3 gives good 15, short 2; excess when received above invoiced; damaged above received refused; invoiced 20, received 0 gives short 20, no line value, charge share or per-unit cost

<!-- /coderabbit-ai-generated:v1 -->
- [ ] T005 [P] Write tests in `core/tests/purchasing/priceAlert.test.ts` and `sellingPriceSuggestion.test.ts`: ₹63 after ₹60 at 2% gives an alert of 5.0%; ₹61 does not; no earlier price from the distributor uses any distributor's last; ₹63.00 at 20% suggests ₹79
- [ ] T006 [P] Write tests in `core/tests/purchasing/payables.test.ts` and `debitNoteStatus.test.ts`: due date = invoice date + credit days; due this week = open bills due in the next 7 days; statuses only move one step forward
- [ ] T007 [P] Write tests in `core/tests/warranty/warrantyEnd.test.ts`: sold 31 Jan plus 1 month ends 28 or 29 Feb (end of month rule, using Luxon from 001 D25)
- [ ] T008 Implement `core/src/purchasing/*.ts` and `core/src/warranty/*.ts` to pass T003 to T007
- [ ] T009 Add the tables of `data-model.md` to `desktop/src/main/db/schema.ts` (receipt status trigger blocking changes after `posted`; append-only triggers on bills, links, price history, returns, debit notes and events, serials; `UNIQUE(party_id, supplier_invoice_no, financial_year)` for non-cash bills; unique `receipt_id` in `purchase_bill_receipt`) and generate the migration
- [ ] T010 Insert the lookup rows of `data-model.md` (movement types `purchase` and `purchase_return`, document types, ledger entry types with their signs, `cash_purchase`, exception kinds, document kinds) with no table rebuild (002 research D17), and add `payment.direction` `out`; test that the migration is additive (012 D10); add `category.target_margin_bp` and `requires_isi`; seed the permission `payment.pay`
- [ ] T011 Write `desktop/tests/integration/migrations009.test.ts`: migrations on a database with all earlier features; nothing existing changes; triggers hold

---

## Phase 3: User Story 1 - Goods receipt with landed cost (M2, 11 to 17 Oct; P1) MVP

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:d9beabc69052d00f2f3642c5096ee0500f131269a97014652f2aacb85395710b -->

- [ ] T012 [P] [US1] Write tests in `desktop/src/main/services/purchasing/ReceiptService.test.ts`: draft saves and recomputes the preview; posting in one transaction writes the number, good stock to the location and damaged stock to Defective through `MovementService`, batches with MRP and landed cost, price history, compliance records, exceptions (missing ISI, duplicate supplier invoice), the variant's new purchase price and an audit entry; idempotent by `clientReceiptId`; posted receipts reject changes; a fully short line alongside a received line keeps the invoiced quantity without a batch, stock movement or variant cost update, and charges go only to the received line

<!-- /coderabbit-ai-generated:v1 -->
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

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:200b459956566b91ecdd9ef7c0407ca178c254d59b09256101e7ef2d7c9701b3 -->

- [ ] T025 [P] [US4] Write tests in `desktop/src/main/services/purchasing/PurchaseReturnService.test.ts`: return from Defective writes `purchase_return` movements, a debit note number, a positive `debit_note` entry and a `raised` event in one transaction; short-only lines move no stock and a fully short receipt line’s note uses its invoiced unit price; reject cumulative physical returns above received and cumulative short claims above the original shortage, including across separate short-only returns; post a ₹200 debit note before its linked ₹1,000 purchase bill, then verify the bill has ₹800 open and contributes ₹800 to the correct ageing bucket; `debitNotes.advance` moves one step and logs user and time; settled cannot advance

<!-- /coderabbit-ai-generated:v1 -->
- [ ] T026 [US4] Implement `PurchaseReturnService.ts` and `PurchaseReturnRepository.ts` to pass T025; register `purchaseReturns.*`, `debitNotes.*`; debit note print layout `desktop/src/main/services/purchasing/debitNoteHtml.ts`
- [ ] T027 [P] [US4] Build `desktop/src/renderer/features/purchasing/PurchaseReturn/` (from a receipt, lines, reason; debit note status timeline)
- [ ] T028 [US4] Write the e2e spec `desktop/tests/e2e/purchaseReturns.spec.ts` for quickstart 4

---

## Phase 7: User Story 5 (FR-010 data only) - Warranty register (M5, 5 to 7 Nov; V3 data from MVP)

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:17c1db0c198bdd7e20503da2759c0e9f781697f9d82c5c2b62b9328e87e2173e -->

- [ ] T029 [P] [US5] Write tests in `desktop/tests/integration/warrantyRegister.test.ts`: a serial-tracked line needs as many serials as whole units (`SERIALS_REQUIRED`); the bill transaction writes `bill_line_serial` rows and `warranty_register` rows with the end date; cancel removes them; after changing the variant’s warranty duration, rebuild from the bill-line snapshot and verify the rows and original end date still match the incremental table
- [ ] T030 [US5] Add serial capture to 003's `SaveBill.ts` and a serial prompt to the bill screen in `desktop/src/renderer/features/billing/SerialPrompt/`; implement `desktop/src/main/services/warranty/WarrantyRegisterService.ts` to pass T029. Skip only the serial capture work already completed in 003 under OD-1. The warranty register service and T029 remain required

<!-- /coderabbit-ai-generated:v1 -->
- [ ] T031 [P] [US5] Build `desktop/src/renderer/features/warranty/WarrantyLookup/` (by serial, bill number or phone; "In warranty until" or "Out of warranty since")
- [ ] T032 [US5] Write the e2e spec `desktop/tests/e2e/warrantyRegister.spec.ts` for quickstart 5

---

## Phase 8: Polish

- [ ] T033 [P] Check every new screen in System, Light and Dark (quickstart 6); debit notes print black on white
- [ ] T034 [P] Move all new screen text into `desktop/src/renderer/strings.ts`
- [ ] T035 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`

---

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:13f273f03c250ce292dccd4b574f07ef7d85533381a75f5b415cdd33c8b01efb -->

## Dependencies and execution order

```
T000 --> 003 implementation --> 003 merge --> Setup
Setup --> Foundational --> US1 --> US2 --> US3 --> US4 --> US5 (data) --> Polish
```

US2 needs posted receipts; US3 needs price history written at posting (US1); US4 needs posted receipts and the ledger (US2). 003 always saves the sale-time warranty snapshot. Only serial capture can move into 003 under OD-1; the projection is built in US5.

<!-- /coderabbit-ai-generated:v1 -->

## Parallel examples

- Phase 2: T003 to T007 together.
- US2: T016 and T017 together.

## Implementation strategy

US1 first: correct landed cost is the base of margin and the below-cost guard. US2 makes payables visible; US3 protects margin; US4 recovers money for damaged and short goods.
