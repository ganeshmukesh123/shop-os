# Implementation Plan: Shop OS MVP (Inventory + Basic Bill)

**Branch**: `001-shop-os-mvp` | **Date**: 2026-11-13, revised 2026-11-15 (owner answers to the spec audit, research D18 to D24) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-shop-os-mvp/spec.md`, the PRD, and the architecture doc (option B: device owns a complete local database; the server and sync come later).

## Summary

A desktop counter app (Mac first, then Windows/Linux) where the owner enters inventory and staff generate basic no-tax bills, then list, reprint and cancel them. Everything is stored in a local SQLite database, so there is no server, no sync and no internet dependency. Business rules live in a pure TypeScript package (`@shopos/core`, the architecture's `shopos_core`) with no UI or database imports, so a later server and phone apps can reuse them. Stock is never edited directly: it is derived from immutable stock-movement records. Every record carries a UUID id and business/shop ids, and from 2026-11-15 the tables follow the architecture's names and shape (research D18), so sync and later features add tables and columns instead of moving data.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Electron ^43.8, React 18, Radix UI (`@radix-ui/themes` for ready-made styled components, with `radix-ui` primitives for anything custom such as dialogs, dropdowns and toasts), electron-vite and Vite 6, drizzle-orm ^0.45 + drizzle-kit ^0.31 (migrations), better-sqlite3 ^13 (Electron build; SQLCipher deferred, research D4), Zod 4 (validation), Electron `printToPDF`/`print` for bill output. No import library: spreadsheet import moved to feature 012.

**Storage**: Single local SQLite file in the OS user-data folder; WAL mode; encryption-ready (key hook present, off by default for MVP); automatic backup copies to a second folder/drive

**Testing**: Vitest (core and data layer, in-memory SQLite), Playwright for Electron (end-to-end flows in quickstart.md)

**Target Platform**: macOS first (owner's machine); Windows and Linux builds from the same code; packaged with electron-builder

**Project Type**: desktop-app (pnpm workspace: `packages/core`, `apps/desktop`)

**Performance Goals**: Item search under 0.5 s with 5,000 items (target 0.2 s with 50,000); bill save plus print dialog in about 1 s; 5-line bill in 60 s or less by a trained user

**Constraints**: Fully offline; saved bills immutable; no bill lost or duplicated; money held as integer paise and quantities as integer thousandths (no floating point); solo builder, low running cost (zero hosting)

**Scale/Scope**: One shop, one counter; about 5,000 items at launch; up to 500 bills a day; 10 years of data; roughly 7 screens (Items, Item form, Adjust stock, New bill, Bill list, Bill view, Settings)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v2.0.0 on 2026-11-15.

| Principle | How this plan satisfies it | Status |
|---|---|---|
| I. Never lose or alter a saved bill version | Bill, lines and movements saved in one transaction; print after commit; database triggers block edits and deletes of saved bills (only the cancel fields may change); cancel keeps the number. `bills.save` is idempotent through a unique `client_bill_id` (review B2, fixed 2026-11-14). Same-day edit (v2.0.0) is not offered in this release. A restore never reuses a bill number (research D21, tasks T082 to T084) | Pass once T082 to T084 are done |
| II. Immutable records | Append-only `stock_movement` (triggers); cached item stock verified against the sum of movements in tests | Pass |
| III. Integer money and quantity | Paise and thousandths; rounding in `packages/core/src/money.ts`; see research D5 and data-model "Rounding" | Pass |
| IV. Offline-first | Local SQLite only; UUID ids; business and shop ids on every table | Pass |
| V. UI-free core | `packages/core` imports no Electron, database or UI code | Pass |
| VI. Test-first | Core and service tests written before implementation (tasks T010 to T014, T030, T041) | Pass |
| VII. Simplicity | Two packages only; Radix UI and Drizzle as chosen; no server | Pass |
| VIII. Readable names | ESLint `id-length` (minimum 2) enforced; existing code renamed on 2026-11-13; readability beyond length is a review check | Pass |
| IX. Small, Pure Code | Core is pure and the main process was split into small modules (spec 017, T020 to T026). The renderer is not yet compliant: `NewBillScreen.tsx` is 472 lines, screens mix state and markup, and there are no per-component folders or `shared/` (audit finding C3). Fixed by tasks T088 to T090 (with 017 T030) | **Violation, tracked** (Complexity Tracking) |
| X. Design Consistency | Printed bills are always light. The renderer is not yet compliant: `<Theme>` has no `appearance` and there is no System, Light or Dark choice; 33 inline `style` uses across screens; the shared `StatusMessage` and `StatusBadge` do not exist (audit finding C3). Fixed by tasks T085 to T087 | **Violation, tracked** (Complexity Tracking) |
| Dev workflow: PR size and gates | PRs of 400 changed lines or fewer; the schema move (D18) is split into T073 to T081 for that reason; CI gate from spec 017 | Pass |
| Unconfirmed facts | Legal defaults D19 to D23 and printer behaviour D24 are open items for the CA, counsel and the real printer | Pass (recorded) |

Post-design re-check (2026-11-15): I to VIII pass with the tasks named; IX and X are violations justified below and must be closed before the counter trial (M6).

## Project Structure

### Documentation (this feature)

```text
specs/001-shop-os-mvp/
├── plan.md              # This file
├── research.md          # Phase 0: decisions
├── data-model.md        # Phase 1: entities, constraints, state
├── quickstart.md        # Phase 1: run and validation scenarios
├── contracts/
│   ├── ipc-commands.md  # Renderer to main-process command contract
│   └── bill-layout.md   # Printed bill contract
├── checklists/requirements.md
└── tasks.md             # Work list (T001 to T090)
```

### Source Code (repository root)

```text
package.json                    # pnpm workspace root
pnpm-workspace.yaml
packages/
└── core/                       # @shopos/core: pure TS, no Electron/DB imports
    ├── src/
    │   ├── money.ts            # paise arithmetic, rounding, round-off, formatting (Indian grouping)
    │   ├── quantity.ts         # unit rules, decimal vs whole, thousandths
    │   ├── billing.ts          # line amount, discounts, grand total
    │   ├── draftBill.ts        # evaluate a draft bill from user input
    │   ├── stock.ts            # fold movements into stock; negative-stock flag
    │   ├── numbering.ts        # bill number formatting, financial year, restore gap
    │   ├── businessDate.ts     # business date in the shop's time zone (new, T079)
    │   ├── types.ts, commands.ts, errors.ts
    │   └── index.ts
    └── tests/
apps/
└── desktop/
    ├── src/
    │   ├── main/               # Electron main process
    │   │   ├── app/            # start-up, window, security headers, shell, backup lifecycle
    │   │   ├── db/             # drizzle schema, connection, ids, seed
    │   │   ├── repositories/   # ItemRepository, StockRepository, BillRepository, SettingsRepository
    │   │   ├── services/       # InventoryService, BillingService, SettingsService, PrintService, BackupService, billHtml, electronRenderer
    │   │   └── ipc/            # handlers.ts and index.ts (contracts/ipc-commands.md)
    │   ├── preload/            # bridge.ts builds the typed bridge from the command list
    │   └── renderer/           # React UI; moving to app/, features/, shared/ (T088 to T090)
    │       ├── screens/
    │       ├── components/
    │       └── state/
    ├── drizzle/                # generated SQL migrations
    └── tests/
        ├── unit/
        ├── integration/        # services against in-memory SQLite
        └── e2e/                # Playwright for Electron
```

**Structure Decision**: Two workspace packages. `core` holds every rule that must behave identically on a future server and phones. `desktop` holds the Electron shell, database and UI. Repositories hide the database from services, so the later sync layer can be added by wrapping the movement and bill writes rather than rewriting them.

## Milestone Plan

Assumes one full-time solo builder starting on the PRD date of 7 Dec 2026; part-time work stretches each milestone proportionally. Each milestone ends with a demo and a go/no-go against its exit criteria before the next begins.

| # | Dates (2026-27) | Milestone | Exit criteria |
|---|---|---|---|
| M-1 | 13 Nov to 6 Dec | **Prep** (before build) | Owner delivers the top 300+ items as a spreadsheet (name, unit, price, quantity); thermal printer model and paper width confirmed; shop name, address, phone and bill-number format decided; constitution filled in |
| M0 | 7 to 13 Dec | **Spike and skeleton** | Electron + React app boots on Mac; Drizzle + better-sqlite3 open, migrate and run in the packaged app; one test PDF and one thermal-width print succeed from the real printer; SQLCipher build confirmed or deferred in writing; pnpm workspace builds and Vitest runs in CI-less local script |
| M1 | 14 to 27 Dec | **Core and data layer** | `@shopos/core` money, quantity, billing and stock functions fully unit tested (rounding, decimals, discounts); schema and migrations applied; repositories pass integration tests; stock derived from movements matches a reference calculation on 20 sample items |
| M2 | 28 Dec to 10 Jan | **Inventory (US1)** | Add, edit, deactivate items; stock adjustment with movement record; fast search; duplicate warning; unit decimal rules enforced; list shows live stock; spec acceptance scenarios 1 to 6 pass in e2e |
| M3 | 11 to 31 Jan | **Billing (US2)** | Search-and-add keyboard flow; line price, quantity and discount edits; correct totals; sequential bill numbers; stock reduces on save; negative stock allowed and flagged; payment label; draft recovery after crash; scenarios 1 to 8 pass; 5-line bill under 60 s measured |
| M4 | 1 to 14 Feb | **Bills and print (US2 and US3)** | Receipt and A4/A5 layout match `contracts/bill-layout.md`; PDF export; print failure never blocks save; bill list search by number, date and customer; reprint identical; cancel with reason restores stock and keeps number; saved bills cannot be edited or deleted |
| M3b | 16 Nov 2026 to 6 Dec 2026 | **Schema in the architecture's shape and the 2026-11-15 decisions** (research D18 to D23) | Tables renamed and reshaped (T073 to T081) with all existing tests green after each PR; round-off, business time zone, document title and restore numbering built and tested (T079 to T084); 31 March and 1 April boundary test passes; triggers re-created and tested in every rebuilt table |
| M5 | 15 to 28 Feb | **Backup, packaging, design compliance** | Light and dark mode and the shared message components (T085 to T087); renderer split (T088 to T090); automatic backup to a second folder tested with a real restore on a clean machine; signed or notarized installer for Mac and unsigned for Windows; settings screen done; written restore guide |
| M6 | 1 to 14 Mar | **Shop trial** | Installed at the counter and used for real bills alongside the paper book for 2 weeks; zero lost or duplicated bills; stock check on 20 items matches (SC-005); 20-bill total check matches (SC-007); top 3 complaints fixed; go or no-go to retire the paper bill book |

**Status (2026-11-15)**: code for M0 to M4 (except US3 and the real printer) was written ahead of these dates and is tracked in `tasks.md`; M3b was inserted on 2026-11-15 and runs before the remaining US3 work so cancel and the bill list are built on the new tables.

**Buffer**: 2 weeks of slack are left after M6 (to about 28 Mar) before starting the next feature (tax, khata, then sync); the PRD's go-live date of 1 June 2027 is not at risk from this MVP.

**Risks and fallbacks**
- Thermal printing on Electron is unreliable: fall back to the OS print dialog with a receipt-width stylesheet, and defer raw ESC/POS to a later milestone.
- SQLCipher build is troublesome in Electron: ship unencrypted with OS disk encryption advised, keep the key hook, revisit before cloud backup.
- Item data is dirty: the duplicate warning is in this release; spreadsheet import with a preview moves to feature 012, so the owner's top items are entered by hand.
- The schema move (M3b) touches every repository: done table by table in small PRs, each with the full test suite green, so a half-done move never reaches `main`.

## Complexity Tracking

| Violation or addition | Why it exists | Why the simpler way was rejected | Closed by |
|---|---|---|---|
| Constitution IX: renderer screens over the size limits, no component folders | Screens were written before the React skill and the folder rule (constitution 1.2.0 to 1.3.0) | Rewriting every screen at once mixes refactor and behaviour change in one PR (development workflow) | T088 to T090 (and spec 017 T030), before M6 |
| Constitution X: no light, dark and System choice; inline styles; no shared message components | Same as above (principle X added in 1.3.0) | Same as above | T085 to T087, before M6 |
| Tables for later features' shape (`item_family` with one variant, one `location`, `bill_tender` for a label) | Owner decision 2026-11-15 (D18): no data move when 002, 003 and 007 arrive | Keeping flat tables means migrating real shop data later | Not a violation; recorded here because it adds tables the spec alone would not need |

Two workspace packages is the only structure beyond a single project, justified by the architecture requirement that rules be shared with a future server and phone apps.
