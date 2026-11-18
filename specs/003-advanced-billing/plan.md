# Implementation Plan: Advanced Counter Billing

**Branch**: `003-advanced-billing` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-advanced-billing/spec.md`, PRD section 6 and the permissions table, the architecture reference sections 5.3, 5.4, 8.3, 8.5, 10.4, 11.1 and 11.2, the constitution v2.1.0 (principle I as amended in v2.0.0), and the designs of 001, 002, 004 and 005.

## Summary

Make the counter fast and safe: keyboard-only billing with tier and party prices, MRP cap and below-cost approval, discount limits per role, split payments with UPI QR and pending confirmation, held bills, returns with credit notes, quotations with versions and conversion, same-day edits that save a new bill version under the same number, cancel with approval, and one-tap unmet demand. Rules are pure functions in `@shopos/core`; the bill-writing services keep 001's one-transaction, idempotent, commit-before-print guarantees. Nothing saved is edited: versions, returns, tender resolutions and reversing movements are all new rows (research D1, D6, D9).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Unchanged from 001 and 002. One addition needs owner approval: the `qrcode` package for the UPI QR (OD-1).

**Storage**: Same SQLite file. New tables `tender_resolution`, `held_bill`, `sales_return`, `sales_return_line`, `credit_note`, `quotation`, `quotation_line`, `unmet_demand`; new columns on `bill`, `bill_line`, `bill_tender`, `item_batch`, `shop_profile`, `number_series`; new lookup rows (`edit_reverse`, `sale_return`, tender statuses, document kinds; 002 research D17), no table rebuild; `bill`'s two unique indexes widened to include `version_no` and `device_id` (offline edit forks are kept and flagged).

**Testing**: Vitest test-first for every core rule and every bill, return, tender and stock write; Playwright for Electron for the quickstart scenarios; a timed 5-line keyboard bill.

**Target Platform**: macOS first; Windows and Linux.

**Project Type**: desktop-app (pnpm workspace).

**Performance Goals**: 5-line bill in 45 s or less (SC-001); bill save and print about 1 s with tenders, ledger and audit rows (NFR-002); return in under 60 s (SC-006); repricing 30 lines on a tier change under 50 ms.

**Constraints**: Offline (UPI confirmation is manual); integer paise; approvals single-use and bound to one subject; no saved bill version, line, tender, return or movement changed.

**Scale/Scope**: Up to 500 bills a day, 10 held bills per counter, about 8 new panels (tender, held bills, return, quote, versions, approval prompt, customer quick-add, unmet demand).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle                            | How this plan satisfies it                                                                                                                                                                                                                                         | Status                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| I. Saved bill versions never altered | Same-day edit inserts a new version row with the same number; the previous version is untouched and readable; the edit is audited (005); edits allowed only on the same business date by a permitted role; cancel keeps the number and needs a reason and approval | Pass                               |
| II. Immutable records                | Edits write `edit_reverse` and new `sale` movements; returns write `sale_return`; UPI confirmation is a `tender_resolution` row, not an update; ledger effects go through 004's append-only entries                                                                | Pass                               |
| III. Integers                        | Discounts in basis points converted once; bill discount spread with remainder on the last line; UPI amount text built from integer paise                                                                                                                           | Pass                               |
| IV. Offline-first                    | Everything works offline; UPI confirmation by staff-entered reference; remote approval (010) optional, PIN approval local                                                                                                                                          | Pass                               |
| V. UI-free core                      | Price resolution, guards, limits, tenders, refunds, quote rules, same-day check in `@shopos/core`                                                                                                                                                                  | Pass                               |
| VI. Test-first                       | Tests before code for core and for `bills.save`, `bills.edit`, `bills.cancel`, `returns.save`, tender resolution (tasks.md)                                                                                                                                        | Pass                               |
| VII. Simplicity                      | V2 and V3 items (US7: site return, challan, quote from list) not planned; one package (QR) waits for approval; WhatsApp by link                                                                                                                                    | Pass                               |
| VIII. Readable names                 | Units in every money and quantity name                                                                                                                                                                                                                             | Pass                               |
| IX. Small, pure code                 | `NewBillScreen` was already split in 001 T088 to T090; new panels each in their own folder with a hook                                                                                                                                                             | Pass (depends on 001 T088 to T090) |
| X. Design consistency                | Status words for "Pending UPI", "Confirmed", "Replaced", "Manual price", "Cost unknown", "Above MRP"; both themes checked; printed documents light                                                                                                                 | Pass                               |
| Unconfirmed facts                    | Bank acceptance of amount QR, QR on legal documents, discount limits recorded as OI-1 to OI-4                                                                                                                                                                      | Pass (recorded)                    |

Post-design re-check (2026-11-18): no violations. The architecture's `bill_revision` design is replaced by version rows (research D1) because the architecture predates constitution v2.0.0; a dated note is added to the architecture in Polish.

## Project Structure

### Documentation (this feature)

```text
specs/003-advanced-billing/
├── plan.md
├── research.md                 # D1 to D16
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ipc-commands.md
│   └── keyboard-shortcuts.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/core/src/
├── pricing/      # resolveUnitPrice.ts, priceGuards.ts, discountLimit.ts, spreadBillDiscount.ts
├── tenders/      # allocateTenders.ts, upiIntent.ts, creditLimit.ts
├── returns/      # refundForReturnLine.ts
├── quotes/       # openQuoteQuantities.ts, quoteValidity.ts
├── billing/      # versionRules.ts (same-day, current version), interStateCheck.ts, seriesGaps.ts
└── commands.ts, types.ts (new command schemas)

apps/desktop/src/main/
├── repositories/ # BillRepository (versions), TenderRepository, HeldBillRepository, ReturnRepository,
│                 # QuotationRepository, DemandRepository
├── services/
│   ├── billing/          # BillingService split: SaveBill, EditBill, CancelBill (one use case each)
│   ├── tenders/          # TenderService (confirm, replace, pending list), UpiQrService
│   ├── returns/          # ReturnService
│   ├── quotes/           # QuotationService
│   ├── held/             # HeldBillService
│   └── demand/           # DemandService
├── ports/                # ApprovalPort, AuditPort, PartyLedgerPort (implemented by 004 and 005)
└── ipc/handlers.ts
apps/desktop/src/renderer/features/billing/
├── shortcuts.ts, ShortcutHelp/
├── TenderPanel/, UpiQr/, HeldBills/, CustomerPicker/, ApprovalPrompt/, LineGuardBadge/
├── ReturnScreen/, QuoteMode/, BillVersions/, UnmetDemand/
apps/desktop/drizzle/     # new migrations
```

**Structure Decision**: Same two packages. `BillingService` is split into one use case per write (save, edit, cancel) because edit adds more than the service's size limit allows (constitution IX). Ports let the services be tested with fakes before 004 and 005 code exists, and keep the dependency direction inward.

## Milestone Plan

Window 26 April to 6 June 2027 (proposed, 002 research D16), after 005 and 004.

| #     | Dates            | Milestone                                                      | Exit criteria                                                                                                  |
| ----- | ---------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| M1    | 26 Apr to 2 May  | Core rules and schema                                          | All core modules green, test-first; migrations on a copy of the owner's database with every earlier test green |
| M2    | 3 to 9 May       | Keyboard billing, tiers, held bills (US1)                      | Quickstart 1; SC-001 timed                                                                                     |
| M3    | 10 to 23 May     | Price guards, discounts, tenders, UPI, credit limit (US2, US3) | Quickstart 2 and 3; OI-1 and OI-4 answered; OD-1 decided                                                       |
| M4    | 24 to 30 May     | Returns and credit notes (US4)                                 | Quickstart 4; SC-006 timed; OI-3 answered                                                                      |
| M5    | 31 May to 6 Jun  | Quotations, edit, cancel, unmet demand (US5, US6)              | Quickstart 5, 6 and 7                                                                                          |
| Trial | 2 weeks after M5 | At the counter                                                 | SC-002 to SC-005 measured over 2 weeks (zero bills above MRP; every guarded line has an approval)              |

**Risks and fallbacks**

- The bank rejects amount QR codes: show the bank's static QR and the amount in large text; confirmation stays manual.
- 004 or 005 slips: the ports have fakes; credit tenders and approvals are switched off (spec assumptions: "before then credit sales are unavailable"; owner PIN on the device).
- The version design touches every bill query: one PR adds `version_no` and the "current version" query with all 001 tests green before edit is built.

## Complexity Tracking

| Addition                             | Why it is needed                                      | Simpler alternative rejected because                                    |
| ------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| Version rows sharing a bill number   | Constitution I (v2.0.0) and FR-014                    | Snapshot table with an updated header breaks immutability (research D1) |
| `tender_resolution` table            | UPI confirmation without updating a saved tender      | Updating the tender status edits a saved record                         |
| Ports for approval, audit and ledger | Build and test before 004 and 005 code; keep layering | Calling 004 and 005 services directly couples the use cases             |
| `qrcode` package (OD-1)              | Amount-bearing UPI QR (FR-BIL-011)                    | An in-house QR encoder risks a wrong payee QR                           |
