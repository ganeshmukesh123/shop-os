---
description: "Task list for feature 003: advanced counter billing"
---

# Tasks: Advanced Counter Billing

**Input**: Design documents from `/specs/003-advanced-billing/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, contracts/keyboard-shortcuts.md, quickstart.md. Features 002, 004 and 005 merged (or their ports faked, plan risks).

**Tests**: Included and written first (constitution VI: everything here writes bills, tenders, stock or ledger).

**Organization**: One phase per user story: US1, US2, US3 (P1), then US4, US5, US6 (P2). US7 (site return, challan, quote from list: V2 and V3) is **not planned** (constitution VII). The inter-state rule (FR-018) is built in Phase 2 and switched on by 006 and 008.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel-safe; **[Story]**: US1 to US6. `core` = `packages/core`, `desktop` = `apps/desktop`.

---

## Phase 1: Setup

- [ ] T001 Confirm 002, 004 and 005 are merged; if 004 or 005 is not, create fakes for `ApprovalPort`, `AuditPort` and `PartyLedgerPort` in `desktop/src/main/ports/fakes/` and note which stories are limited in `specs/003-advanced-billing/plan.md`
- [ ] T002 Ask the owner OD-1 (the `qrcode` package) and OI-4 (discount limits) and record the answers in `specs/003-advanced-billing/research.md`
- [ ] T003 [P] Define `ApprovalPort`, `AuditPort` and `PartyLedgerPort` interfaces in `desktop/src/main/ports/` (method names from feature 005 and 004 contracts) with `types.ts`

---

## Phase 2: Foundational (M1, 26 Apr to 2 May 2027)

### Core rules, tests first

- [ ] T004 [P] Write tests in `core/tests/pricing/resolveUnitPrice.test.ts`: party ₹105 beats Contractor ₹110 beats Retail ₹120; a manual price is kept on a tier change
- [ ] T005 [P] Write tests in `core/tests/pricing/spreadBillDiscount.test.ts`: ₹100 on ₹600 and ₹400 gives ₹60 and ₹40; ₹100 on three lines of ₹333.33 gives shares that sum to exactly ₹100.00 with the remainder on the last line; zero discount gives zeros
- [ ] T006 [P] Write tests in `core/tests/pricing/discountLimit.test.ts`: effective discount (line plus bill) as basis points of gross; 3% limit allows ₹30 off ₹1,000 and refuses ₹31; splitting across lines does not bypass it
- [ ] T007 [P] Write tests in `core/tests/pricing/priceGuards.test.ts`: cap per base unit = `mrp_paise x 1000 / mrp_pack_qty_milli` rounded down (MRP ₹4,500 per 90 m coil gives ₹50.00 per metre); ₹460 over a ₹450 cap gives `above_mrp`; ₹290 under cost ₹300 gives `below_cost`; no cost gives `cost_unknown`; no batch gives no cap
- [ ] T008 [P] Write tests in `core/tests/tenders/allocateTenders.test.ts` and `creditLimit.test.ts`: tenders must sum to the total; change due ₹150 on ₹2,000 cash for ₹1,850; credit ₹8,000 on balance ₹45,000 and limit ₹50,000 is over the limit
- [ ] T009 [P] Write tests in `core/tests/tenders/upiIntent.test.ts`: `upi://pay?pa=shop@bank&pn=Shop%20Name&am=1000.00&cu=INR&tn=C1%2F26-27%2F000123`; 5 paise gives `0.05`; values URL-encoded; no floating point used (property test over 0 to 10,00,00,000 paise)
- [ ] T010 [P] Write tests in `core/tests/returns/refundForReturnLine.test.ts`: 2 of 5 at ₹110 with a ₹10 share each refunds ₹200; a line of 5 at ₹110 with ₹50 line discount (`amount_paise` ₹500) and ₹50 bill-discount share refunds 2 x ₹90 = ₹180 (the line discount is not subtracted twice); refund uses the original net price, never a current price; rounding half up once Several returns of one line: a 2-unit line with a 1-paise net refunds 1 then 0, never more than the net in total.
- [ ] T011 [P] Write tests in `core/tests/quotes/quoteRules.test.ts`: open quantity = quoted minus converted; valid until issue date + 7; expired on day 9 needs a pricing choice
- [ ] T012 [P] Write tests in `core/tests/billing/versionRules.test.ts`, `interStateCheck.test.ts`, `seriesGaps.test.ts`: same business date allows edit, next date refuses; current version is the one no row replaces; composition with another state gives `INTER_STATE_UNDER_COMPOSITION`; seqs 1, 2, 4 with `last_seq` 4 give gap 3
- [ ] T013 Implement `core/src/pricing/*.ts`, `core/src/tenders/*.ts`, `core/src/returns/*.ts`, `core/src/quotes/*.ts`, `core/src/billing/*.ts` to pass T004 to T012, exported from `core/src/index.ts`

### Schema

- [ ] T014 Add to `desktop/src/main/db/schema.ts`: `bill.version_no` (default 1), `previous_version_id` (CHECK set exactly when `version_no > 1`; not unique, so offline forks can be stored), `edit_reason` (1-200, required when `version_no > 1`), `party_id`, `price_tier_id` (default Retail), `place_of_supply_state` (2 digits), `quotation_id`, `cancel_approval_id`, `user_id`; replace the unique indexes with `(shop_id, bill_no, version_no, device_id)` and `(counter_code, financial_year, seq, version_no, device_id)` (the second replaces 001's `bill_counter_fy_seq_uq`; without it no version 2 can be inserted); drop the uniqueness of `previous_version_id`; generate the migration and test that every 001 bill gets version 1 and that a version 2 with the same `seq` inserts
- [ ] T015 Add `bill_line` columns `batch_id`, `mrp_cap_paise` (CHECK `mrp_cap_paise is null or unit_price_paise <= mrp_cap_paise`), `is_manual_price`, `bill_discount_share_paise` (0 or more), `approval_id`, `quotation_line_id`, and store `cost_paise` (cost per base unit at sale x quantity, from the batch's landed cost, else the variant's purchase price, else null) on every line, not only tinted ones (011 research D5 needs it for cost of goods sold); backfill `bill_discount_share_paise` for 001 bills with `spreadBillDiscount` in the migration and test that shares sum to each bill's discount
- [ ] T016 Add rows to 002's lookup tables (no rebuild): `tender_mode` `credit` (if 004 has not), `tender_status` `settled` and `pending_confirmation`; on `bill_tender` add `reference` (up to 40; partial unique index `(business_id, reference) where mode = 'upi' and reference is not null`), `tendered_paise` (cash only, at least `amount_paise`), `approval_id`; add `tender_resolution` (append-only, unique `tender_id`, `kind` `confirmed` needs `reference`, `replaced` needs `replacement_mode`)
- [ ] T017 Add lookup rows (no rebuild): `movement_type` `edit_reverse` and `sale_return` (direction in, doc required), `movement_doc_type` `sales_return`; add `location.kind` `defective` and seed "Defective"; add `item_batch.mrp_pack_qty_milli` (above 0, default 1000); add `shop_profile.home_state_code`, `upi_vpa`, `upi_payee_name`, `quote_validity_days` (1 to 90, default 7); add the `doc_kind` lookup table (seeded `bill`, `return`, `quotation`, `credit_note`) with `number_series.doc_kind` as a foreign key, and `bill_number_gap.reason` value `device_crash`
- [ ] T018 Add `held_bill`, `sales_return` (CHECK `bill_id is not null or approval_id is not null`), `sales_return_line`, `credit_note`, `quotation`, `quotation_line`, `unmet_demand` (text 1-120 or `variant_id`) to `desktop/src/main/db/schema.ts` with append-only triggers on the return, credit note and quotation tables
- [ ] T019 Write `desktop/tests/integration/migrations003.test.ts`: migrations on a database shaped like 001 plus 002; every bill, line, tender and movement unchanged; new triggers reject UPDATE and DELETE
- [ ] T020 Change every bill query in `desktop/src/main/repositories/BillRepository.ts` to read the current version (`bills.list`, `bills.get`, reprint, cancel) with tests in `desktop/tests/integration/currentVersion.test.ts`; all 001 and 002 tests green (its own PR)

**Checkpoint (M1 exit)**: core green, schema migrated, current-version reads in place.

---

## Phase 3: User Story 1 - Fast keyboard billing with price tiers (M2, 3 to 9 May; P1) MVP

**Independent Test**: quickstart 1.

- [ ] T021 [P] [US1] Write tests in `desktop/src/main/services/billing/PriceLinesService.test.ts` for `bills.price`: party price, tier, retail, manual; batches listed oldest first; no writes
- [ ] T022 [P] [US1] Write tests in `desktop/src/main/services/held/HeldBillService.test.ts`: hold 10, the 11th gives `HELD_LIMIT_REACHED`; recall returns the payload and removes the row; held bills are per counter
- [ ] T023 [P] [US1] Write tests in `desktop/tests/integration/saveBillWithParty.test.ts`: `bills.save` with `partyId` and `tierCode` stores them and the snapshot name; `CUSTOMER_REQUIRED` for a non-Retail tier or a warranty-tracked line without a party
- [ ] T024 [US1] Implement `desktop/src/main/services/billing/PriceLinesService.ts` and `HeldBillService.ts` in `desktop/src/main/services/held/` with `HeldBillRepository.ts` to pass T021 and T022
- [ ] T025 [US1] Extend `desktop/src/main/services/billing/SaveBill.ts` (split from `BillingService.ts`) for party, tier and customer rules to pass T023
- [ ] T026 [US1] Add `bills.price` and `held.*` to `core/src/commands.ts` and `desktop/src/main/ipc/handlers.ts`
- [ ] T027 [P] [US1] Create `desktop/src/renderer/features/billing/shortcuts.ts` from `contracts/keyboard-shortcuts.md` and `ShortcutHelp/` (F1)
- [ ] T028 [P] [US1] Build `desktop/src/renderer/features/billing/CustomerPicker/` (F7; search by name or phone; quick-add with name, phone and consent tick through 004's command)
- [ ] T029 [P] [US1] Build `desktop/src/renderer/features/billing/HeldBills/` (F3 hold, F4 recall list)
- [ ] T030 [US1] Wire tier repricing into the bill screen hook (`useBillDraft`): changing the party calls `bills.price` and keeps manual prices with a "Manual price" badge; focus returns to search after each line
- [ ] T031 [US1] Write the e2e spec `desktop/tests/e2e/keyboardBilling.spec.ts` for quickstart 1 and record the SC-001 timing in `specs/003-advanced-billing/plan.md`

---

## Phase 4: User Story 2 - Price guards: MRP cap and below-cost approval (M3, 10 to 16 May; P1)

**Independent Test**: quickstart 2.

- [ ] T032 [P] [US2] Write tests in `desktop/tests/integration/priceGuards.test.ts`: `bills.save` with a line above the cap fails `ABOVE_MRP` and writes nothing; below cost without an approval gives `APPROVAL_REQUIRED`; with a valid approval saves and consumes it; a reused or expired approval gives `APPROVAL_INVALID`; an approval for ₹290 does not allow ₹280
- [ ] T033 [US2] Implement the guards in `desktop/src/main/services/billing/SaveBill.ts` through `ApprovalPort` to pass T032
- [ ] T034 [P] [US2] Build `desktop/src/renderer/features/billing/LineGuardBadge/` ("Above MRP ₹450.00", "Below cost", "Cost unknown" as words plus colour) and the batch switch (Ctrl+B)
- [ ] T035 [P] [US2] Build `desktop/src/renderer/features/billing/ApprovalPrompt/` (owner PIN dialog, 2-minute countdown, approve, reject; on reject or timeout revert the line price)
- [ ] T036 [US2] Write the e2e spec `desktop/tests/e2e/priceGuards.spec.ts` for quickstart 2

---

## Phase 5: User Story 3 - Discounts, split payment and UPI confirmation (M3, 17 to 23 May; P1)

**Independent Test**: quickstart 3.

- [ ] T037 [P] [US3] Write tests in `desktop/tests/integration/tenders.test.ts`: split ₹1,000 cash + ₹1,000 UPI saves two tenders; UPI without reference is `pending_confirmation`; `tenders.confirm` writes one resolution; the same reference twice gives `DUPLICATE_REFERENCE`; `tenders.replace` by cash; a second resolution gives `ALREADY_RESOLVED`; tenders not matching the total give `TENDERS_DO_NOT_MATCH_TOTAL` The same UPI reference on a second tender, by save, confirm or UPI replacement, gives `DUPLICATE_REFERENCE`; replacing a pending UPI tender with credit over the limit gives `APPROVAL_REQUIRED`, and the retry with `approvalId` writes the resolution and the ledger debit in one transaction.
- [ ] T038 [P] [US3] Write tests in `desktop/tests/integration/creditTender.test.ts`: a credit tender writes one ledger entry through `PartyLedgerPort` in the bill transaction; over the limit gives `APPROVAL_REQUIRED`; a failure in the ledger write rolls back the whole bill
- [ ] T039 [P] [US3] Write tests in `desktop/tests/integration/discountLimit.test.ts`: the user's limit from 005 is applied to line plus bill discount; over it needs an approval
- [ ] T040 [US3] Implement `desktop/src/main/services/tenders/TenderService.ts` with `TenderRepository.ts`, and the credit and discount rules in `SaveBill.ts`, to pass T037 to T039
- [ ] T041 [US3] Implement `desktop/src/main/services/tenders/UpiQrService.ts` (`buildUpiIntent` plus the approved QR encoder, SVG out) and `tenders.*` commands in `desktop/src/main/ipc/handlers.ts`
- [ ] T042 [P] [US3] Build `desktop/src/renderer/features/billing/TenderPanel/` (F8; cash with tendered amount and change due; UPI; card; credit; several parts) and `UpiQr/` (QR with "₹1,000.00" in large text, "Pending" until the reference is typed)
- [ ] T043 [P] [US3] Add a "Pending UPI" list with confirm and replace actions to the bill list screen in `desktop/src/renderer/features/billing/`
- [ ] T044 [US3] Add shop settings for UPI VPA, payee name and home state to the Settings screen in `desktop/src/renderer/features/settings/`
- [ ] T045 [US3] Write the e2e spec `desktop/tests/e2e/tenders.spec.ts` for quickstart 3

---

## Phase 6: User Story 4 - Returns and credit notes (M4, 24 to 30 May; P2)

**Independent Test**: quickstart 4.

- [ ] T046 [P] [US4] Write tests in `desktop/src/main/services/returns/ReturnService.test.ts`: 2 of 5 lines by credit note writes the return, lines, `sale_return` movements to Shop floor, a credit note and one ledger entry in one transaction; `RETURN_EXCEEDS_SOLD` after an earlier return; no-bill return without approval refused; tinted line needs a `tinted_return` approval and goes to `tinted_returns` with `write_down_paise`; idempotent by `clientReturnId`; refund at the original price after a tier change
- [ ] T047 [US4] Implement `desktop/src/main/services/returns/ReturnService.ts` and `desktop/src/main/repositories/ReturnRepository.ts` (return series numbers through `number_series` with `doc_kind` `return` and `credit_note`) to pass T046
- [ ] T048 [US4] Print a QR holding `shopos:bill:<bill id>` on bills in `desktop/src/main/services/billHtml.ts` and add it to `specs/001-shop-os-mvp/contracts/bill-layout.md` (pending OI-3)
- [ ] T049 [US4] Add `returns.*` commands to `core/src/commands.ts` and `desktop/src/main/ipc/handlers.ts`, and a return print layout in `desktop/src/main/services/returns/returnHtml.ts`
- [ ] T050 [P] [US4] Build `desktop/src/renderer/features/billing/ReturnScreen/` (F6; find by number, phone or QR scan; line and quantity picker showing returnable quantity; destination; refund mode; reason)
- [ ] T051 [US4] Write the e2e spec `desktop/tests/e2e/returns.spec.ts` for quickstart 4 and time SC-006

---

## Phase 7: User Story 5 - Quotations (M5, 31 May to 3 Jun; P2)

**Independent Test**: quickstart 5.

- [ ] T052 [P] [US5] Write tests in `desktop/src/main/services/quotes/QuotationService.test.ts`: save with validity from `quote_validity_days`; revise gives version 2 with the same number and version 1 unchanged; `quotes.prepareBill` on day 5 keeps prices, on day 9 needs `keep` or `refresh`; converting more than open gives `QUOTE_LINE_OVERDRAWN`; quotes write no stock or ledger
- [ ] T053 [P] [US5] Write tests in `desktop/tests/integration/quoteConversion.test.ts`: a bill saved from a quote stores `quotation_id` and `quotation_line_id`; open quantities fall; kept prices still pass MRP and cost guards Two drafts from one quote line of 10 pcs, for 6 each: the first save succeeds, the second gives `QUOTE_LINE_OVERDRAWN` and writes nothing; after a same-day edit of the converted bill the open quantity counts only the current version.
- [ ] T054 [US5] Implement `desktop/src/main/services/quotes/QuotationService.ts` and `desktop/src/main/repositories/QuotationRepository.ts` to pass T052 and T053; `quotes.*` commands; quote PDF layout
- [ ] T055 [US5] Implement `bills.share` and `quotes.share` (PDF plus `https://wa.me/` link) and add `https://wa.me/` to the external-link allow-list of feature 018's navigation policy in `desktop/src/main/app/navigationPolicy/`
- [ ] T056 [P] [US5] Build `desktop/src/renderer/features/billing/QuoteMode/` (F5; validity; versions; convert with line picker and pricing choice)
- [ ] T057 [US5] Write the e2e spec `desktop/tests/e2e/quotes.spec.ts` for quickstart 5

---

## Phase 8: User Story 6 - Edit, cancel and unmet demand (M5, 4 to 6 Jun; P2)

**Independent Test**: quickstart 6.

- [ ] T058 [P] [US6] Write tests in `desktop/src/main/services/billing/EditBill.test.ts`: C1/26-27/000123 2 pcs x ₹120 edited to 3 pcs saves version 2 (₹360) with the same number; version 1 row and lines byte-for-byte unchanged; movements +2 `edit_reverse` and -3 `sale`; credit part reversed and re-entered through `PartyLedgerPort`; one audit row with user, time, reason; next day `EDIT_NOT_SAME_DAY`; role without `bill.edit` gives `PERMISSION_DENIED`; editing version 1 after version 2 gives `NOT_CURRENT_VERSION`; two versions 2 of the same bill from two devices (applied as pulled rows) are both kept, the latest by HLC is current and one `bill_version_conflict` exception is raised A bill with a return gives `BILL_HAS_RETURNS`. Fork: two offline edits of version 1 (3 pcs and 4 pcs); after the fork is settled, the losing leaf's movements and ledger entries are reversed, and stock is down 3, not 5.
- [ ] T059 [P] [US6] Write tests in `desktop/src/main/services/billing/CancelBill.test.ts`: cancel needs reason and approval; reverses the current version's `sale` movements; number kept; a cancelled bill cannot be edited
- [ ] T060 [P] [US6] Write tests in `desktop/tests/integration/seriesGapCheck.test.ts`: a missing seq is recorded once as `device_crash` at start A return series with seq 1 and no bill of that seq records no gap: each series is compared with its own document table.
- [ ] T061 [US6] Implement `desktop/src/main/services/billing/EditBill.ts` and `CancelBill.ts` to pass T058 and T059; `bills.edit`, `bills.versions`, `bills.cancel` with approval
- [ ] T062 [US6] Implement the start-up gap check in `desktop/src/main/app/startApp.ts` with `findSeriesGaps` to pass T060
- [ ] T063 [P] [US6] Implement `desktop/src/main/services/demand/DemandService.ts` with tests; `demand.*` commands
- [ ] T064 [P] [US6] Build `desktop/src/renderer/features/billing/BillVersions/` (version list, each readable, "Version 2 of 2" label) and an Edit button shown only on the same business day for permitted roles
- [ ] T065 [P] [US6] Build `desktop/src/renderer/features/billing/UnmetDemand/` (Ctrl+U from the "No match" row)
- [ ] T066 [US6] Write the e2e spec `desktop/tests/e2e/editCancel.spec.ts` for quickstart 6

---

## Phase 9: Polish and cross-cutting

- [ ] T067 [P] Check every new panel in System, Light and Dark (quickstart 7) against `docs/design/design-guidelines.md`
- [ ] T068 [P] Move all new screen text into `desktop/src/renderer/strings.ts`
- [ ] T069 [P] Add a dated note to `docs/reference/architecture.md` sections 7.5 and 11.2: bill versions are rows sharing the number (research D1), not `bill_revision`
- [ ] T070 Update `specs/001-shop-os-mvp/contracts/bill-layout.md` for discount shares, multiple tenders, pending UPI, version label and the QR
- [ ] T071 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`
- [ ] T072 Two-week counter trial: record SC-002 to SC-005 in `specs/003-advanced-billing/plan.md` (zero bills above MRP; approval record on 100% of guarded lines; 98% UPI confirmed the same day)

---

## Dependencies and execution order

```
Setup --> Foundational (M1) --> US1 (M2) --> US2 --> US3 (M3) --> US4 (M4) --> US5, US6 (M5) --> Polish
```

- US2 and US3 need US1's priced save path. US4 needs US3's tenders (cash and UPI refunds) and 004's credit notes. US5 is independent of US4. US6 needs the version reads of T020.
- Within a story: tests, services, commands, screens, e2e.

## Parallel examples

- Phase 2: T004 to T012 together, then T013.
- US3: T037, T038, T039 together; then T042 and T043.
- US6: T058, T059, T060 together; T063, T064, T065 together.

## Implementation strategy

1. MVP slice: Foundational and US1 (tiers, keyboard, held bills); use it at the counter.
2. US2 and US3 together (guards and payments are the owner's biggest fears, spec US3).
3. US4, then US5 and US6.
4. Separate PRs for: the current-version read change (T020), the lookup-row migration (T016, T017), each use-case service.
