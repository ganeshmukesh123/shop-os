# Implementation Plan: Parties and Khata (Credit)

**Branch**: `004-parties-khata` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-parties-khata/spec.md`, PRD section 8, the architecture reference sections 7.4 and 11.5, the constitution v2.1.0, and the designs of 001, 002, 003 and 005.

## Summary

Add parties (customers, contractors, dealers, distributors, staff) with phones, tier, credit limit, credit days, referrer and consent, and an append-only khata ledger whose balance always equals the sum of its entries. Credit bills from the 001 bill screen post to the ledger in the bill's transaction; payments are allocated oldest first (or to chosen bills) and give a numbered receipt; ageing is derived from open amounts; statements and bulk reminders go out as WhatsApp links with a UPI link and a locally saved PDF; opening balances import with a confirmation total. V2 items (promises, cheques, bank matching, sites, commission, write-off) are out.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Unchanged; no new package (statements use `printToPDF`, import reuses 002's engine, WhatsApp by link).

**Storage**: Same SQLite file. New tables `party`, `party_phone`, `party_price`, `consent_record`, `party_ledger_entry`, `ledger_allocation`, `party_balance`, `payment`, `reminder_log`, `message_template`; new columns `bill.party_id`, `bill_tender` mode `credit`, `number_series.doc_kind` value `receipt`.

**Testing**: Vitest test-first for core (allocation, ageing, credit check, statement, GSTIN) and every ledger write; Playwright for the quickstart; a ledger property test (random entries, balance equals sum).

**Target Platform**: macOS first; Windows and Linux.

**Project Type**: desktop-app (pnpm workspace).

**Performance Goals**: Party search about 0.2 s at 5,000 parties; ageing for all parties under 1 s at 50,000 open bill entries; payment save under 0.5 s; bulk reminders about 2 s of owner time per party (SC-003).

**Constraints**: Offline; ledger append-only; contact data only on the party record (erasable later, 001 D19); WhatsApp by link only until the pilot.

**Scale/Scope**: About 1,000 credit parties at go-live, up to 5,000; 6 screens (party list, party page with ledger and ageing, payment, statement, reminders, import preview).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle                           | How this plan satisfies it                                                                                                                                        | Status          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| I. Saved bill versions              | A credit bill and its ledger entry are one transaction; cancel writes a reversing entry; the bill is never changed                                                | Pass            |
| II. Balances from immutable records | `party_ledger_entry` and `ledger_allocation` append-only; `party_balance` is a projection checked at start and nightly (SC-004); corrections are opposite entries | Pass            |
| III. Integers                       | Signed paise; ageing and allocation in integers                                                                                                                   | Pass            |
| IV. Offline-first                   | All local; WhatsApp links open when online, nothing blocks billing                                                                                                | Pass            |
| V. UI-free core                     | Allocation, ageing, credit check, statement, templates, GSTIN in core                                                                                             | Pass            |
| VI. Test-first                      | Core and every ledger write tested first (tasks.md)                                                                                                               | Pass            |
| VII. Simplicity                     | V2 stories out; no package; links instead of a messaging API                                                                                                      | Pass            |
| VIII to X                           | Readable names; party page split into folders; balances shown with words ("owes ₹5,000", "advance ₹2,000"); both themes                                           | Pass            |
| Privacy (constraints)               | Only fields the PRD lists; consent recorded per purpose; erasure deferred to 008 with the shape ready                                                             | Pass            |
| Unconfirmed facts                   | GSTIN checksum, hosted PDF, `upi://` in WhatsApp, Hindi template, ageing base: OI-1 to OI-5                                                                       | Pass (recorded) |

Post-design re-check (2026-11-18): no violations.

## Project Structure

### Documentation (this feature)

```text
specs/004-parties-khata/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
└── contracts/ipc-commands.md
```

### Source Code (repository root)

```text
packages/core/src/khata/   # ledgerSum.ts, allocateOldestFirst.ts, ageing.ts, partyCredit.ts, statement.ts,
                           # messageTemplate.ts, gstin.ts, phone.ts
apps/desktop/src/main/
├── repositories/          # PartyRepository, LedgerRepository, PaymentRepository, ReminderRepository, TemplateRepository
├── services/
│   ├── parties/           # PartyService (create, update, phones, prices, consent)
│   ├── ledger/            # LedgerService (post, reverse, verify) and PartyLedgerPort adapter for 003
│   ├── payments/          # PaymentService (receive, reverse, receipt)
│   ├── statements/        # StatementService (PDF, share link)
│   ├── reminders/         # ReminderService (overdue list, prepare, log)
│   └── import/            # party import mapping on 002's ImportService
└── ipc/handlers.ts
apps/desktop/src/renderer/features/khata/
├── PartyList/, PartyForm/, PartyPage/ (LedgerTable/, AgeingCard/, PartyPrices/)
├── ReceivePayment/, StatementShare/, Reminders/, PartyImport/
```

**Structure Decision**: Same two packages. `LedgerService` is the only writer of ledger entries; billing (001 now, 003 later) calls it through `PartyLedgerPort` inside its own transaction.

## Milestone Plan

Window 22 March to 25 April 2027 (proposed, 002 research D16), after 005.

| #     | Dates                | Milestone                                   | Exit criteria                                                                     |
| ----- | -------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| M1    | 22 to 28 Mar         | Core rules and schema                       | Core khata modules green test-first; migrations on a copy of the owner's database |
| M2    | 29 Mar to 4 Apr      | Parties, ledger, credit bills, limits (US1) | Quickstart 1; OI-1 answered                                                       |
| M3    | 5 to 11 Apr          | Ageing and payments (US2)                   | Quickstart 2; OI-5 answered                                                       |
| M4    | 12 to 18 Apr         | Statements and reminders (US3)              | Quickstart 3; OI-2 to OI-4 answered; SC-002 and SC-003 timed                      |
| M5    | 19 to 25 Apr         | Opening balance import (US4)                | Quickstart 4 and 5; SC-005 on the owner's real balances                           |
| Trial | 90 days from go-live | Collection                                  | SC-001 (overdue over 30 days down 30%) and SC-006 measured                        |

**Risks and fallbacks**

- WhatsApp link flow too slow for 50 reminders: batch by area and send over two sittings; the Business Platform at the pilot (013).
- Old books are not in a spreadsheet: a manual opening-balance entry screen (one row per party, same confirmation total).
- 002's import engine not merged: build the CSV preview here and let 002 and 012 reuse it.

## Complexity Tracking

| Addition                             | Why it is needed                                                                  | Simpler alternative rejected because                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `ledger_allocation` table            | Bill-by-bill ageing and "apply to selected bill" (FR-003) without editing entries | Storing a "paid amount" on the bill entry updates an append-only record                     |
| `party_balance` projection           | Fast balance on every bill and list                                               | Summing entries per row is slow at 5,000 parties; the projection is checked against the sum |
| `consent_record` here instead of 008 | The bill screen's quick-add consent tick (003) is built before 008                | Waiting for 008 means parties without consent records                                       |
