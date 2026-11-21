---
description: "Task list for feature 008: GST, bill formats, turnover, scheme switch, DPDP consent"
---

# Tasks: GST, Bill Formats and Compliance

**Input**: Design documents from `/specs/008-gst-compliance/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, contracts/bill-formats.md, quickstart.md. M0 needs 004 and 005; the rest needs 002, 003, 004, 005.

**Tests**: Included and written first (constitution VI: tax amounts are written on bills).

**Organization**: Phase 0 is the DPDP slice (M0) built early because of the 13 May 2027 start date. Then US1, US2, US3, US5 (P1), US4 and US6 scenario 1 (P2). US6's V2 and V3 items (CA exports, instrument reminders, GSTR exports, simulator) are **not planned**.

## Format: `[ID] [P?] [Story] Description`

`core` = `packages/core`, `desktop` = `apps/desktop`.

---

## Phase 0: DPDP consent slice (M0, 3 to 12 May 2027; US5 scenarios 2 to 4)

- [ ] T001 Ask counsel OI-5 and OI-6 and the owner OD-1; record answers in `specs/008-gst-compliance/research.md`
- [ ] T002 [P] [US5] Write tests in `core/tests/privacy/eraseParty.test.ts` and `requestDueDate.test.ts`: erasure blanks phones, address, area, pin, GSTIN, notes and sets the name to "Erased customer <first 4 of id>"; consents untouched; a party with a balance gives `deferred` with "outstanding balance"; due date from the configured period
- [ ] T003 [US5] Add `privacy_notice` (append-only; `UNIQUE(version, language)`), `data_request` (kinds and statuses of `data-model.md`; note required for `deferred` and `rejected`) and `party.is_erased` to `desktop/src/main/db/schema.ts`; generate the migration
- [ ] T004 [US5] Implement `core/src/privacy/*.ts` to pass T002
- [ ] T005 [P] [US5] Write tests in `desktop/src/main/services/privacy/DataRequestService.test.ts`: access export writes JSON and PDF; erasure leaves every bill row and line byte for byte unchanged and reprints identically; erasure audited; consent withdrawal writes a new `consent_record`
- [ ] T006 [US5] Implement `desktop/src/main/services/privacy/NoticeService.ts`, `DataRequestService.ts` and `desktop/src/main/repositories/PrivacyRepository.ts` to pass T005; register `privacy.*`

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:96656aff49b5b349069bd2a74db9a9e1a4c8be7944a455bf1d3c0219ce64b635 -->

- [ ] T007 [US5] Feature 008 owns the consent work for both 004's `parties.create` and 003's quick-add; record this dependency before 003 starts quick-add. Both paths must capture the transactional tick and `noticeVersion` and return `CONSENT_REQUIRED` if the tick is missing. Quick-add may ship only once it uses this contract. Cover both paths in `desktop/tests/integration/consentOnCreate.test.ts`

<!-- /coderabbit-ai-generated:v1 -->

- [ ] T008 [P] [US5] Build `desktop/src/renderer/features/privacy/ConsentTicks/` (notice text, two separate ticks), `PrivacyNotice/` (publish a version in English and Hindi) and `DataRequests/` (list, due dates, export, erase)
- [ ] T009 [US5] Write the e2e spec `desktop/tests/e2e/privacy.spec.ts` for quickstart 0; ship before 13 May 2027

---

## Phase 1: Setup (feature window from 7 Jun 2027)

- [ ] T010 Send the CA the list OI-1 to OI-4 and OI-7 with sample bills; record the answers in `specs/008-gst-compliance/research.md`
- [ ] T011 [P] Create `core/src/gst/` with an `index.ts` barrel exported from `core/src/index.ts`

---

## Phase 2: Foundational (M1, 7 to 13 Jun)

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ebf68069fb5132254a15bfa44da538d0940dcb94a649b3c6dd5b3fe5e7f960a7 -->

- [ ] T012 [P] Write golden tests in `core/tests/gst/taxLine.test.ts`: ₹1,180.00 at 18% gives ₹1,000.00, ₹90.00, ₹90.00; ₹100.01 at 18% gives taxable ₹84.75, CGST ₹7.63, SGST ₹7.63; a line at ₹1,180.00 with ₹118.00 line discount (`amount_paise` ₹1,062.00) gives taxable ₹900.00, CGST ₹81.00, SGST ₹81.00 (the line discount is taken once, through `amount_paise`); separately, with no line discounts, allocate a ₹177.00 bill discount across lines of ₹1,180.00 and ₹590.00 by amount: assert shares of ₹118.00 and ₹59.00, and for the first line at 18% intra-state assert net ₹1,062.00, taxable ₹900.00 and CGST and SGST ₹81.00 each; inter-state gives IGST only; 0% gives no tax; for 10,000 random nets and the rates 0, 5, 12, 18, 28 every line satisfies taxable + CGST + SGST + IGST = net

<!-- /coderabbit-ai-generated:v1 -->

- [ ] T013 [P] Write tests in `core/tests/gst/gstRate.test.ts`: longest prefix wins (85 at 18%, 8539 at 12% before 22 Sep 2025 then 18%); override beats HSN from its date; overlapping ranges rejected; no HSN falls back to the category default, then 18% with source `fallback`

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:c93831035fc8b7165f26b97447a52a2ecce76b5b99ae4433fe0fa002c73915dc -->

- [ ] T014 [P] Write tests in `core/tests/gst/registration.test.ts` and `taxBill.test.ts`: the row in force at an instant; a switch at 14:00 makes a 13:59 bill a bill of supply and a 14:01 bill a tax invoice; a cancelled future registration never wins, including at and after its scheduled instant; bill totals equal the sum of lines plus round-off; bills of supply and estimates have zero CGST, SGST and IGST but retain the after-discount subtotal as taxable value

<!-- /coderabbit-ai-generated:v1 -->

- [ ] T015 [P] Write tests in `core/tests/gst/turnover.test.ts`: FY sum minus returns; levels at 80%, 95% and crossed with the crossing date; ₹75 lakh limit
- [ ] T016 [P] Write tests in `core/tests/gst/switchChecklist.test.ts`, `priceSuggestion.test.ts`, `closingStock.test.ts`: items without HSN listed; template over 16 characters fails; "keep final" keeps the price; "add GST" on ₹100 at 18% suggests ₹118; closing stock shows "Purchase tax not recorded" when absent
- [ ] T017 Implement `core/src/gst/*.ts` to pass T012 to T016

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:038a92415c634bcf50a75ebbe92999e07a63d81641690fe971e5c3dd76393420 -->

- [ ] T018 Add `registration_setting` (append-only), `hsn_rate` (no overlapping ranges per prefix), `item_tax_override`, `turnover_daily`, `scheme_switch` (forward-only status trigger), tax columns on `bill` and `bill_line`, bill identity snapshots with immutability protection, and registration-specific series keys and numbering constraints per `data-model.md`, `shop_profile.composition_limit_paise` and `turnover_warn_bp` to `desktop/src/main/db/schema.ts`; generate the migration; existing bills get `doc_format = 'estimate'`, `taxable_paise` equal to the subtotal after discounts, and zero CGST, SGST and IGST

<!-- /coderabbit-ai-generated:v1 -->

- [ ] T019 Seed `hsn_rate` rows from research D3 with `verified = 0` and `source_ref` naming the architecture research; test in `desktop/tests/integration/migrations008.test.ts` that no existing bill or line changes and the new CHECKs hold

---

## Phase 3: User Story 1 - Correct bill format by registration (M2, 14 to 17 Jun; P1)

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:03715cb785b1bc3aac9f3a20e98d55b97d7001bacf7b8a6857206b7c59d6e65a -->

- [ ] T020 [P] [US1] Write tests in `desktop/tests/integration/billFormats.test.ts`: under composition a bill saves as `bill_of_supply` with zero tax; under regular as `tax_invoice` with line tax and both GSTIN snapshots; changing shop and party names or addresses after saving leaves reprints unchanged; a bill edited after a switch keeps its original format (the version's `billed_at` is the original's); idempotency unchanged
- [ ] T021 [P] [US1] Write `desktop/tests/integration/numbering10000.test.ts`: 10,000 bills across composition → regular → composition in one financial year: no repeated number, none above 16 characters, a new series at each switch (SC-005)
- [ ] T022 [US1] Implement `desktop/src/main/services/gst/RegistrationService.ts` and `TaxService.ts`, and call `TaxService` from 003's `SaveBill.ts` and `EditBill.ts`, to pass T020 and T021; implement the read methods of `GstRateRepository` over the dated HSN rates and item overrides from T018–T019, and use the T017 resolver for billing; register `gst.registration.*`

<!-- /coderabbit-ai-generated:v1 -->

- [ ] T023 [US1] Split `desktop/src/main/services/billHtml.ts` into `desktop/src/main/services/billHtml/estimateHtml.ts`, `billOfSupplyHtml.ts`, `taxInvoiceHtml.ts` following `contracts/bill-formats.md`, with snapshot tests of each layout at 80 mm and A4
- [ ] T024 [P] [US1] Build `desktop/src/renderer/features/gst/Registration/` (current registration, history, set initial)
- [ ] T025 [US1] Write the e2e spec `desktop/tests/e2e/billFormats.spec.ts` for quickstart 1; give printed samples to the CA (OI-3)

---

## Phase 4: User Story 2 - HSN and dated GST rates (M2, 18 to 20 Jun; P1)

- [ ] T026 [P] [US2] Write tests in `desktop/tests/integration/datedRates.test.ts`: bills on 21 and 22 Sep 2025 (test clock) use 12% and 18% for HSN 8539; a future rate change applies only from its date; a missing HSN raises one `missing_hsn` exception per item

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:41f6b9a56c2ac24c5b08ed1a417c6ece50ad4b5b88024ac2da731b2420b34f37 -->

- [ ] T027 [US2] Extend `desktop/src/main/repositories/GstRateRepository.ts` for rate management; implement `gst.rates.*`, `gst.itemOverride.add`, `gst.rateFor` to pass T026

<!-- /coderabbit-ai-generated:v1 -->

- [ ] T028 [P] [US2] Build `desktop/src/renderer/features/gst/GstRates/` (rates by prefix with dates and "Unverified" label; item override on the item form from 002)
- [ ] T029 [US2] Write the e2e spec `desktop/tests/e2e/gstRates.spec.ts` for quickstart 2

---

## Phase 5: User Story 3 - Turnover tracker (M3, 21 to 24 Jun; P1)

- [ ] T030 [P] [US3] Write tests in `desktop/src/main/services/gst/TurnoverService.test.ts`: `turnover_daily` updated in bill, cancel, edit and return transactions; rebuild equals incremental; crossing raises one exception with the date
- [ ] T031 [US3] Implement `TurnoverService.ts` and `TurnoverRepository.ts` to pass T030; `gst.turnover.*`
- [ ] T032 [P] [US3] Build `desktop/src/renderer/features/gst/TurnoverCard/` (home screen and day close: amount, percent, level word "Near limit", "Over limit"; banner with "Talk to your CA")
- [ ] T033 [US3] Write the e2e spec `desktop/tests/e2e/turnover.spec.ts` for quickstart 3 steps 1 and 2 (SC-002)

---

## Phase 6: User Story 5 - Inter-state rule (M3, 25 to 27 Jun; P1)

- [ ] T034 [US5] Write tests in `desktop/tests/integration/interState008.test.ts` and wire the registration in force into 003's `checkInterStateSale` call: composition plus another state blocked; regular plus another state gives IGST
- [ ] T035 [US5] Write the e2e check for quickstart 3 step 3 in `desktop/tests/e2e/turnover.spec.ts`

---

## Phase 7: User Story 4 - Scheme-switch wizard (M4, 28 Jun to 2 Jul; P2)

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:67c3012d606e7ca3d691399ff43c9a16c9c3c8de0ffa450adb5e4b481bf4389d -->

- [ ] T036 [P] [US4] Write tests in `desktop/src/main/services/gst/SchemeSwitchService.test.ts`: start in the future only; checklist blocks confirm; final closing-stock statement includes movements after confirmation through the effective instant and excludes later movements; confirm schedules the registration, new series and audited prices in one transaction, with no partial write on failure; with `add_gst`, a ₹100 item at 18% stays ₹100 on a bill of supply just before the switch and is ₹118 on a tax invoice at the effective instant; cancelling before that instant prevents all three scheduled changes, and cancelling at or after it is rejected

<!-- /coderabbit-ai-generated:v1 -->

- [ ] T037 [US4] Implement `SchemeSwitchService.ts` and `SwitchRepository.ts` to pass T036; closing-stock PDF and CSV; `gst.switch.*`
- [ ] T038 [P] [US4] Build `desktop/src/renderer/features/gst/SchemeSwitchWizard/` (five steps of research D7, each with its own folder and hook)
- [ ] T039 [US4] Write the e2e spec `desktop/tests/e2e/schemeSwitch.spec.ts` for quickstart 4 steps 1 to 3 and time SC-003

---

## Phase 8: User Story 6 scenario 1 - Records cannot be deleted (M4, 3 to 4 Jul; P2)

- [ ] T040 [US6] Write `desktop/tests/integration/noDeletes.test.ts`: DELETE on `bill`, `bill_line`, `bill_tender`, `party_ledger_entry`, `stock_movement`, `audit_log` is rejected by triggers; no IPC command deletes them (checked against the command list)
- [ ] T041 [US6] Add the retention note (72 months from the annual return due date; the app keeps everything) to the restore guide

---

## Phase 9: Polish

- [ ] T042 [P] Check every new screen in System, Light and Dark; printed formats black on white (quickstart 5)
- [ ] T043 [P] Move all new screen text into `desktop/src/renderer/strings.ts`; notice texts stay data
- [ ] T044 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`
- [ ] T045 Two-week trial: check 50 bills for the right format (SC-001) and rehearse a switch (SC-003); record in `specs/008-gst-compliance/plan.md`

---

## Dependencies and execution order

```
Phase 0 (M0, May) ......................................... independent, early
Setup --> Foundational (M1) --> US1 --> US2 --> US3 --> US5 --> US4 --> US6 sc.1 --> Polish
```

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:e3c21a4e99c990727a590a0b56e711dec16e76790bafda36be8c63e0a8a8fb20 -->

US1 uses the rate resolver, tables and seed data from T017–T019. US2 follows US1 in M2 and extends its rate access with management commands and screens. US4 needs US1 to US3.

<!-- /coderabbit-ai-generated:v1 -->

## Parallel examples

- Phase 2: T012 to T016 together.
- Phase 0: T002 and T005 together after T003.

## Implementation strategy

1. Phase 0 first, in May, because it has a legal start date.
2. US1 and US2 together give legal bills; the paper book retires only after the CA signs off printed samples.
3. US3 and US5 close the composition risks; the wizard (US4) is needed only before a real switch.
