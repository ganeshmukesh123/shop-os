---
description: "Task list for feature 004: parties and khata"
---

# Tasks: Parties and Khata (Credit)

**Input**: Design documents from `/specs/004-parties-khata/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, quickstart.md. Features 002 and 005 merged.

**Tests**: Included and written first (constitution VI: ledger entries and credit bills).

**Organization**: US1 to US4 (all P1). US5 and US6 are V2 and **not planned** (constitution VII).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel-safe; **[Story]**: US1 to US4. `core` = `packages/core`, `desktop` = `apps/desktop`.

---

## Phase 1: Setup

- [ ] T001 Confirm 002 and 005 are merged on `main` and that 005's `ApprovalPort` is available; record the state in `specs/004-parties-khata/plan.md`
- [ ] T002 [P] Create `core/src/khata/` with an `index.ts` barrel exported from `core/src/index.ts`

---

## Phase 2: Foundational (M1, 22 to 28 Mar 2027)

### Core rules, tests first

- [ ] T003 [P] Write tests in `core/tests/khata/ledgerSum.test.ts`: opening ₹12,000 + bill ₹8,000 - payment ₹15,000 = ₹5,000; a property test of 1,000 random entries where the balance always equals the sum; sign rules per entry type (`bill_credit` positive, `payment` negative, `adjustment` either)
- [ ] T004 [P] Write tests in `core/tests/khata/allocateOldestFirst.test.ts`: bills ₹3,000, ₹5,000, ₹2,000 and ₹6,000 paid give ₹3,000 and ₹3,000; selected bill first; excess stays as advance; negative allocations undo a reversed payment; no allocation above a bill's open amount; the same function allocates a ₹5,000 `payment_out` against negative purchase-bill entries (009) using absolute amounts
- [ ] T005 [P] Write tests in `core/tests/khata/ageing.test.ts`: buckets 0-30, 31-60, 61-90, over 90 from the bill's business date; cut points from settings; day 30 is in 0-30 and day 31 in 31-60
- [ ] T006 [P] Write tests in `core/tests/khata/partyCredit.test.ts`: limit ₹50,000, balance ₹45,000, new ₹8,000 gives `over_limit`; new ₹2,000 gives `warn_near_limit` (94%); a bill 45 days old with credit days 30 gives `overdue` with "Overdue bill #<number>"; limit 0 or null gives `CREDIT_NOT_ALLOWED`
- [ ] T007 [P] Write tests in `core/tests/khata/statement.test.ts`: opening balance = sum before the period and shown first; entries in date order; closing = opening + period entries
- [ ] T008 [P] Write tests in `core/tests/khata/messageTemplate.test.ts`, `gstin.test.ts`, `phone.test.ts`: placeholders `{name}`, `{amount}` (Indian grouping), `{oldest_bill}`, `{upi_id}`, `{shop_name}` filled; unknown placeholder rejected; GSTIN 15 characters with state code, PAN shape, `Z` and a check character (warning only); phones normalised to 10 digits with `+91` and spaces removed
- [ ] T009 Implement `core/src/khata/*.ts` to pass T003 to T008

### Schema

- [ ] T010 Add `party` (fields and limits of data-model.md: name 1-80 trimmed, pin 6 digits, GSTIN 15 characters, credit limit 0 or more, credit days 0 to 365, referrer not itself), `party_phone` (one primary per party; index on `phone`, not unique), `party_price` (`UNIQUE(party_id, variant_id)`), `consent_record` (append-only) to `desktop/src/main/db/schema.ts` and generate the migration
- [ ] T011 Add the `ledger_entry_type` lookup table (`code`, `sign`, seeded from `data-model.md`) and `party_ledger_entry` (entry type a foreign key, sign checked by a trigger reading the lookup; note required for `adjustment` and `payment_reverse`; approval required for `adjustment`; one `opening_balance` per party), `ledger_allocation` (`settling_entry_id`, `settled_entry_id`, absolute bounds), `party_balance`, `payment` (UPI reference unique per business; cheque fields required for `cheque`; `client_payment_id` unique), `reminder_log`, `message_template` (seed English and Hindi reminder and statement templates) with append-only triggers on entries, allocations, payments, consent and reminder log

- [ ] T012 Add `bill.party_id`, the lookup rows `tender_mode` `credit` and `doc_kind` `receipt` (if 003 has not added the lookup and `number_series.doc_kind` FK, create them, seed and default to `bill`, backfill existing series to `bill`, and recreate `number_series_uq` on `(shop_id, counter_code, financial_year, doc_kind)`; 002 research D17), `shop_profile.upi_vpa`, `upi_payee_name` (if absent) and `ageing_buckets` (JSON, default `[30, 60, 90]`)

- [ ] T013 Write `desktop/tests/integration/migrations004.test.ts`: migrations on a database shaped like 001 plus 002 plus 005; existing bill series keep their counters and sequences and are tagged `bill` if migrated here; bill and receipt series can share the same shop/counter/year key, but duplicate keys for one kind fail; triggers reject UPDATE and DELETE on the append-only tables

### Ledger service (the only writer)

- [ ] T014 Write tests in `desktop/src/main/services/ledger/LedgerService.test.ts`: post writes the entry and updates `party_balance` in the caller's transaction; a failure rolls both back; `verify` finds a deliberately corrupted balance and logs one `exception_event`; `rebuildPartyBalances` restores it
- [ ] T015 Implement `desktop/src/main/repositories/LedgerRepository.ts`, `desktop/src/main/services/ledger/LedgerService.ts` and the `PartyLedgerPort` adapter in `desktop/src/main/services/ledger/partyLedgerAdapter.ts` to pass T014; run `verify` at start in `desktop/src/main/app/startApp.ts`

**Checkpoint (M1 exit)**: core green; schema migrated; ledger writer in place.

---

## Phase 3: User Story 1 - Party ledger with credit limit and days (M2, 29 Mar to 4 Apr; P1) MVP

**Independent Test**: quickstart 1.

- [ ] T016 [P] [US1] Write tests in `desktop/src/main/services/parties/PartyService.test.ts`: create with two phones and one primary; same phone on another party gives a `SAME_PHONE_AS` warning and saves; bad GSTIN gives a warning; deactivate never deletes; consent recorded as rows

- [ ] T017 [P] [US1] Write tests in `desktop/tests/integration/creditBill.test.ts`: `bills.save` with `partyId` and `paymentMode` `credit` writes the bill, one `credit` tender and one `bill_credit` entry in one transaction; over limit or overdue returns `APPROVAL_REQUIRED`; with an approval saves and stores the approval id on the tender; `CREDIT_NEEDS_PARTY`; cancel writes `bill_cancel_reverse` and releases active allocations without ageing or reminding on the cancelled bill; retry or later payment reversal cannot release an allocation twice; retry with the same `clientBillId` posts nothing twice Cancelling credit bill A (₹100, ₹40 paid) while bill B (₹50) is open applies the released ₹40 to B in the same transaction: B shows ₹10 open, A has no open amount and is out of ageing and reminders. With an older positive opening balance of ₹30 and a newer open bill, the released ₹40 settles the ₹30 opening balance first, then ₹10 of the bill.

- [ ] T018 [P] [US1] Write tests in `desktop/tests/integration/ledgerAdjust.test.ts`: `ledger.adjust` needs a note and an approval; writes one `adjustment` entry
- [ ] T019 [US1] Implement `desktop/src/main/repositories/PartyRepository.ts` and `desktop/src/main/services/parties/PartyService.ts` to pass T016
- [ ] T020 [US1] Extend `desktop/src/main/services/BillingService.ts` (or 003's `SaveBill.ts` if merged) for credit bills and cancel through `PartyLedgerPort` to pass T017; implement `ledger.adjust` to pass T018
- [ ] T021 [US1] Add `parties.*`, `ledger.list`, `ledger.checkCredit`, `ledger.adjust`, `ledger.verify` to `core/src/commands.ts` and `desktop/src/main/ipc/handlers.ts`
- [ ] T022 [P] [US1] Build `desktop/src/renderer/features/khata/PartyList/` (search by name or phone, balance with words "owes" or "advance") and `PartyForm/` (all fields; warnings shown before save)
- [ ] T023 [P] [US1] Build `desktop/src/renderer/features/khata/PartyPage/` with `LedgerTable/` (entries, running balance) and `PartyPrices/`
- [ ] T024 [US1] Add a party picker and "Credit (khata)" payment choice to the 001 bill screen in `desktop/src/renderer/features/billing/`, with the 80% warning and the approval prompt from 005
- [ ] T025 [US1] Write the e2e spec `desktop/tests/e2e/partyLedger.spec.ts` for quickstart 1; record OI-1 (GSTIN check on 20 real numbers) in `specs/004-parties-khata/research.md`

---

## Phase 4: User Story 2 - Ageing and receiving payments (M3, 5 to 11 Apr; P1)

**Independent Test**: quickstart 2.

- [ ] T026 [P] [US2] Write tests in `desktop/src/main/services/payments/PaymentService.test.ts`: receive ₹6,000 allocates oldest first; selected bill first; an `allocateTo` list mixing this customer's bill and another customer's bill rejects the entire payment without allocating or issuing a receipt; advance remainder; UPI without reference gives `REFERENCE_REQUIRED`; duplicate UPI reference (also one used on a bill tender) gives `DUPLICATE_REFERENCE`; cheque needs number, bank and date; one transaction (payment, entry, allocations, receipt number); idempotent by `clientPaymentId`; reverse writes `payment_reverse` and negative allocations. Carry the same mixed-party rejection case into 009's payables allocation test (T017 in the 009 plan): `payments.pay` rejects a purchase bill from another distributor with no payment or allocations written

- [ ] T027 [P] [US2] Write tests in `desktop/tests/integration/ageingQuery.test.ts`: `ledger.ageing` over 50,000 open entries under 1 s; per-bill rows and bucket totals equal a manual calculation; negative customer opening balance settles a later credit bill up to its available advance; fully allocated negative purchase bills have zero open amount

- [ ] T028 [US2] Implement `desktop/src/main/repositories/PaymentRepository.ts` and `desktop/src/main/services/payments/PaymentService.ts` to pass T026; receipt series `RC{counter}/{fy}/{seq5}`
- [ ] T029 [US2] Implement `ledger.ageing` in `LedgerService.ts` to pass T027; allocate new credit bills against an existing advance automatically
- [ ] T030 [US2] Implement receipt layout `desktop/src/main/services/payments/receiptHtml.ts`, `payments.printReceipt` and `payments.shareReceipt`
- [ ] T031 [P] [US2] Build `desktop/src/renderer/features/khata/ReceivePayment/` (mode, amount, reference or cheque fields, bill picker with open amounts, allocation preview) and `PartyPage/AgeingCard/`
- [ ] T032 [P] [US2] Add an all-parties ageing list to `desktop/src/renderer/features/khata/PartyList/`
- [ ] T033 [US2] Write the e2e spec `desktop/tests/e2e/payments.spec.ts` for quickstart 2; record OI-5 in `specs/004-parties-khata/research.md`

---

## Phase 5: User Story 3 - WhatsApp statements and reminders (M4, 12 to 18 Apr; P1)

**Independent Test**: quickstart 3.

- [ ] T034 [P] [US3] Write tests in `desktop/src/main/services/statements/StatementService.test.ts`: statement for a period has the opening balance first and the right closing balance; the WhatsApp URL has the phone in `91XXXXXXXXXX` form and the message filled from the template; the UPI link is left out with a warning when no VPA is set
- [ ] T035 [P] [US3] Write tests in `desktop/src/main/services/reminders/ReminderService.test.ts`: the overdue list holds only parties with open bills past their credit days; `prepare` writes one `reminder_log` row per party; consent withdrawn for marketing does not stop a reminder
- [ ] T036 [US3] Implement `StatementService.ts` (PDF through `desktop/src/main/services/electronRenderer.ts`, `statementHtml.ts`) and `ReminderService.ts` with `ReminderRepository.ts` and `TemplateRepository.ts` to pass T034 and T035

- [ ] T037 [US3] Add `statements.*`, `reminders.*`, `templates.*` commands; use 018's WhatsApp allow-list if it ships by M4, otherwise build the dedicated main-process `https://wa.me/` opener in [research D7](research.md#d7-whatsapp-statements-and-reminders-links-not-an-api)

- [ ] T038 [P] [US3] Build `desktop/src/renderer/features/khata/StatementShare/` (period, preview, "Send on WhatsApp": 2 taps from the party page) and `Reminders/` (overdue list, template picker in English or Hindi, step-through with "Next", count sent)
- [ ] T039 [P] [US3] Build a template editor in `desktop/src/renderer/features/khata/Reminders/TemplateEditor/` with placeholder help
- [ ] T040 [US3] Write the e2e spec `desktop/tests/e2e/statements.spec.ts` for quickstart 3 (link opening stubbed); test OI-3 on 5 phones and record OI-2 to OI-4 in `specs/004-parties-khata/research.md`

---

## Phase 6: User Story 4 - Opening balances import (M5, 19 to 25 Apr; P1)

**Independent Test**: quickstart 4.

- [ ] T041 [P] [US4] Write tests in `core/tests/khata/partyImportRows.test.ts`: maps name, type, phones, address, area, pin, GSTIN, tier, limit, days, opening balance, as-of date; reports bad rows with row and column; groups duplicates by phone and near-identical name; totals good rows
- [ ] T042 [P] [US4] Write tests in `desktop/src/main/services/import/PartyImport.test.ts`: commit refuses a typed total that differs by even 1 paisa (`TOTAL_MISMATCH`); commit is one transaction creating parties and one `opening_balance` entry each with the import batch id; importing the same file twice posts nothing new
- [ ] T043 [US4] Implement `core/src/khata/partyImportRows.ts` and `desktop/src/main/services/import/PartyImport.ts` on 002's `ImportService` (or a CSV preview here if 002's is absent) to pass T041 and T042
- [ ] T044 [P] [US4] Build `desktop/src/renderer/features/khata/PartyImport/` (errors, duplicate groups, total, "type the total from your books to confirm")
- [ ] T045 [US4] Write the e2e spec `desktop/tests/e2e/partyImport.spec.ts` for quickstart 4; run it on the owner's real balances (SC-005) and record the result in `specs/004-parties-khata/plan.md`

---

## Phase 7: Polish and cross-cutting

- [ ] T046 [P] Check every khata screen in System, Light and Dark (quickstart 5); receipts and statements print black on white
- [ ] T047 [P] Move all new screen text into `desktop/src/renderer/strings.ts`; message templates stay data (they are already per language)

- [ ] T048 Keep the independent startup `ledger.verify` in `desktop/src/main/app/startApp.ts` after the ledger service is ready. While open, use a one-shot timer for the next midnight in the configured shop time zone. After each run, recalculate from the current time and zone instead of adding 24 hours; replace the pending timer on shop time-zone changes. Recheck on wake before running, prevent overlap with the startup check, and clear on quit. Test startup and successive local midnights, including a zone change while a timer is pending.

- [ ] T049 Note in `specs/003-advanced-billing/data-model.md` (when 003 starts) that `bill.party_id` and tender mode `credit` already exist from 004 (research D3)
- [ ] T050 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`
- [ ] T051 After go-live, measure SC-001 and SC-006 for 90 days and record them in `specs/004-parties-khata/plan.md`

---

## Dependencies and execution order

```
Setup --> Foundational (M1) --> US1 (M2) --> US2 (M3) --> US3 (M4) --> Polish
                                   \--> US4 (M5, needs only US1's party and ledger)
```

## Parallel examples

- Phase 2: T003 to T008 together.
- US1: T016, T017, T018 together; T022 and T023 together.
- US3: T034 and T035 together; T038 and T039 together.

## Implementation strategy

1. MVP slice: Foundational + US1 (parties, ledger, credit bills, limits).
2. US2 (payments and ageing) next: collection is BO-2.
3. US3 and US4; US4 can move earlier if go-live data loading is urgent.
