# Implementation Plan: Purchases, Distributors and Warranty Claims

**Branch**: `009-purchases-warranty` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-purchases-warranty/spec.md`, PRD section 9, the architecture reference sections 6.7, 7.7 and 11.4, the constitution v2.1.0, and the designs of 002, 003, 004, 005, 007 and 008.

**Scope of this plan**: US1 to US4 and FR-016, plus the warranty register **data** (FR-010). Warranty cases and claims (FR-011 to FR-014, V3), schemes (FR-009, V3) and purchase orders (FR-015, Later) are not planned (constitution VII).

## Summary

Record goods from distributors as draft-then-posted receipts with invoiced, received and damaged quantities, batches with MRP, purchase GST per line and ISI numbers; spread freight and other charges exactly by value or quantity into a landed cost per unit that updates the item's cost and the batch used by the below-cost guard. Link purchase bills to receipts, post the payable to the distributor's 004 ledger with a due date from credit days, pay distributors and see ageing and "due this week". Keep price history per distributor, alert on rises above 2% and suggest a selling price for the category's target margin. Return goods with numbered debit notes whose status moves Raised, Sent, Accepted, Settled. Capture serial numbers at sale and keep a warranty register so V3 claims have history.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Unchanged; no new package.

**Storage**: Same SQLite file. New `purchase_receipt`, `purchase_receipt_line`, `purchase_receipt_charge`, `purchase_bill`, `purchase_bill_receipt`, `item_price_history`, `purchase_return`, `purchase_return_line`, `debit_note`, `debit_note_event`, `compliance_record`, `bill_line_serial`, `warranty_register`; enum additions on movements, ledger entries, payments, cash entries, exceptions, number series; `category.target_margin_bp` and `requires_isi`.

**Testing**: Vitest test-first for allocation, landed cost, quantities, alerts, suggestions, due dates, debit-note statuses and every stock, ledger and cash write; Playwright for the quickstart.

**Target Platform**: macOS first; Windows and Linux.

**Project Type**: desktop-app (pnpm workspace).

**Performance Goals**: 20-line receipt posted in under 5 minutes of staff time (SC-001); posting under 1 s; payables list under 0.5 s at 200 distributors.

**Constraints**: Offline; posted documents append-only; exact integer allocation; ledger sign rule shared with 004.

**Scale/Scope**: About 30 receipts a week, 50 distributors; 6 screens (receipt entry, purchase bill, payables and payments, price history and comparison, purchase return and debit notes, warranty lookup).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle              | How this plan satisfies it                                                                                                                                               | Status          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| I. Saved bill versions | Serial numbers are stored as rows written with the bill; no bill changes                                                                                                 | Pass            |
| II. Immutable records  | Posted receipts, bills, returns, debit notes and their events are append-only; stock through `purchase` and `purchase_return` movements; payables through ledger entries | Pass            |
| III. Integers          | Largest-remainder allocation sums exactly; landed cost rounded once                                                                                                      | Pass            |
| IV. Offline-first      | All local                                                                                                                                                                | Pass            |
| V. UI-free core        | Allocation, quantities, alerts, suggestions, due dates, statuses in core                                                                                                 | Pass            |
| VI. Test-first         | Core and every write tested first                                                                                                                                        | Pass            |
| VII. Simplicity        | V3 and Later items out; no purchase orders; delivery days by proxy (OI-1)                                                                                                | Pass            |
| VIII to X              | Status words for "Received, not billed", "Price up", "Due this week"; both themes                                                                                        | Pass            |
| Unconfirmed facts      | BIS list, GST on purchase invoices (OI-2, OI-4)                                                                                                                          | Pass (recorded) |

Post-design re-check (2026-11-18): no violations. OD-1 asks to move serial capture into 003 so warranty data starts at go-live.

## Project Structure

### Documentation (this feature)

```text
specs/009-purchases-warranty/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
└── contracts/ipc-commands.md
```

### Source Code (repository root)

```text
packages/core/src/purchasing/  # allocateCharges.ts, landedCost.ts, lineQuantities.ts, priceAlert.ts,
                               # sellingPriceSuggestion.ts, payables.ts, debitNoteStatus.ts
packages/core/src/warranty/    # warrantyEnd.ts
apps/desktop/src/main/
├── repositories/              # ReceiptRepository, PurchaseBillRepository, PriceHistoryRepository,
│                              # PurchaseReturnRepository, WarrantyRepository
├── services/purchasing/       # ReceiptService, PurchaseBillService, PayablesService, PriceInsightService,
│                              # PurchaseReturnService
├── services/warranty/         # WarrantyRegisterService
└── ipc/handlers.ts
apps/desktop/src/renderer/features/purchasing/
├── ReceiptEntry/ (LineGrid/, ChargesPanel/, PostPreview/), PurchaseBill/, Payables/, PriceInsight/, PurchaseReturn/
apps/desktop/src/renderer/features/warranty/WarrantyLookup/
```

**Structure Decision**: Same two packages. Receipt entry is split into small folders (line grid, charges, preview) to stay inside the component size limit.

## Milestone Plan

Window 4 October to 7 November 2027 (proposed, 002 research D16).

| #   | Dates        | Milestone                                                  | Exit criteria                                                      |
| --- | ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| M1  | 4 to 10 Oct  | Core rules and schema                                      | Core green; migrations on a copy of the owner's database           |
| M2  | 11 to 17 Oct | Goods receipt with landed cost (US1)                       | Quickstart 1; SC-001 and SC-002 on 20 real receipts; OI-2 answered |
| M3  | 18 to 24 Oct | Purchase bills, payables, payments (US2)                   | Quickstart 2; SC-004; OI-4 answered                                |
| M4  | 25 to 31 Oct | Price history, alerts, comparison (US3)                    | Quickstart 3; SC-003; OI-1 and OI-3 answered                       |
| M5  | 1 to 7 Nov   | Returns, debit notes, warranty register (US4, FR-010 data) | Quickstart 4, 5 and 6                                              |

**Risks and fallbacks**

- The godown helper finds receipt entry slow: scan-first entry, and the distributor's invoice number and charges entered by the manager later on the draft.
- Purchase bills arrive weeks after goods: "Received, not billed" keeps the stock right and the payable visible as an estimate.
- OD-1 declined: serials are captured only from this feature's go-live; earlier warranty sales are looked up by bill.

## Complexity Tracking

| Addition                                        | Why it is needed                                              | Simpler alternative rejected because                                     |
| ----------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Receipt and purchase bill as separate documents | Goods and bills arrive at different times (architecture 11.4) | One document hides mismatches between what arrived and what was billed   |
| Draft state for receipts                        | Helpers enter long receipts in steps                          | Posting line by line makes a half receipt move stock                     |
| `warranty_register` projection                  | V3 claims need sale history from now                          | Building it later cannot recover serial numbers that were never captured |
