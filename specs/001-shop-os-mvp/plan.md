# Implementation Plan: Shop OS MVP (Inventory + Basic Bill)

**Branch**: `001-shop-os-mvp` | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-shop-os-mvp/spec.md`, the PRD, and the architecture doc (option B: device owns a complete local database; the server and sync come later).

## Summary

A desktop counter app (Mac first, then Windows/Linux) where the owner enters inventory and staff generate basic no-tax bills, then list, reprint and cancel them. Everything is stored in a local SQLite database, so there is no server, no sync and no internet dependency. Business rules live in a pure TypeScript package (`shopos_core`) with no UI or database imports, so a later server and phone apps can reuse them. Stock is never edited directly: it is derived from immutable stock-movement records. Every record carries a UUID id and business/shop ids so sync can be added later without migrating data.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Electron (current stable), React 18, Radix UI (`@radix-ui/themes` for ready-made styled components, with `radix-ui` primitives for anything custom such as dialogs, dropdowns and toasts), Vite, Drizzle ORM + drizzle-kit (migrations), better-sqlite3 (SQLCipher-capable build selected in the M0 spike), Zod (validation), exceljs (import), Electron `printToPDF`/`print` for bill output

**Storage**: Single local SQLite file in the OS user-data folder; WAL mode; encryption-ready (key hook present, off by default for MVP); automatic backup copies to a second folder/drive

**Testing**: Vitest (core and data layer, in-memory SQLite), Playwright for Electron (end-to-end flows in quickstart.md)

**Target Platform**: macOS first (owner's machine); Windows and Linux builds from the same code; packaged with electron-builder

**Project Type**: desktop-app (pnpm workspace: `packages/core`, `apps/desktop`)

**Performance Goals**: Item search under 0.5 s with 5,000 items (target 0.2 s with 50,000); bill save plus print dialog in about 1 s; 5-line bill in 60 s or less by a trained user

**Constraints**: Fully offline; saved bills immutable; no bill lost or duplicated; money held as integer paise and quantities as integer thousandths (no floating point); solo builder, low running cost (zero hosting)

**Scale/Scope**: One shop, one counter; about 5,000 items at launch; up to 500 bills a day; 10 years of data; roughly 8 screens (Items, Item form, Adjust stock, Import, New bill, Bill list, Bill view, Settings)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.1.0.

| Principle | How this plan satisfies it | Status |
|---|---|---|
| I. Never lose or alter a bill | Bill, lines and movements saved in one transaction; print after commit; database triggers block edits and deletes of saved bills (only the cancel fields may change); cancel keeps the number. Gap: no idempotency key on `bills.save` yet (review finding B2) | Pass with open item |
| II. Immutable records | Append-only `stock_movement` (triggers); cached item stock verified against the sum of movements in tests | Pass |
| III. Integer money and quantity | Paise and thousandths; rounding in `packages/core/src/money.ts`; see research D5 and data-model "Rounding" | Pass |
| IV. Offline-first | Local SQLite only; UUID ids; business and shop ids on every table | Pass |
| V. UI-free core | `packages/core` imports no Electron, database or UI code | Pass |
| VI. Test-first | Core and service tests written before implementation (tasks T010 to T014, T030, T041) | Pass |
| VII. Simplicity | Two packages only; Radix UI and Drizzle as chosen; no server | Pass |
| VIII. Readable names | ESLint `id-length` (minimum 2) enforced; existing code renamed on 2026-11-13; readability beyond length is a review check | Pass |

Post-design re-check: passes; the one open item is B2 (idempotent save), tracked in `docs/reviews/2026-11-13-spec-review.md`. No complexity violations.

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
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
package.json                    # pnpm workspace root
pnpm-workspace.yaml
packages/
└── core/                       # shopos_core: pure TS, no Electron/DB imports
    ├── src/
    │   ├── money.ts            # paise arithmetic, rounding, formatting (Indian grouping)
    │   ├── quantity.ts         # unit rules, decimal vs whole, thousandths
    │   ├── billing.ts          # line amount, discounts, grand total
    │   ├── stock.ts            # fold movements into stock; negative-stock flag
    │   ├── numbering.ts        # bill number formatting
    │   └── types.ts
    └── tests/
apps/
└── desktop/
    ├── src/
    │   ├── main/               # Electron main process
    │   │   ├── db/             # drizzle schema, migrations, connection, backup
    │   │   ├── repositories/   # ItemRepository, StockRepository, BillRepository, SettingsRepository
    │   │   ├── services/       # InventoryService, BillingService, ImportService, PrintService, BackupService
    │   │   └── ipc/            # command handlers (contracts/ipc-commands.md)
    │   ├── preload/            # typed, minimal bridge
    │   └── renderer/           # React UI
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
| M1 | 14 to 27 Dec | **Core and data layer** | `shopos_core` money, quantity, billing and stock functions fully unit tested (rounding, decimals, discounts); schema and migrations applied; repositories pass integration tests; stock derived from movements matches a reference calculation on 20 sample items |
| M2 | 28 Dec to 10 Jan | **Inventory (US1)** | Add, edit, deactivate items; stock adjustment with movement record; fast search; duplicate warning; unit decimal rules enforced; list shows live stock; spec acceptance scenarios 1 to 6 pass in e2e |
| M3 | 11 to 31 Jan | **Billing (US2)** | Search-and-add keyboard flow; line price, quantity and discount edits; correct totals; sequential bill numbers; stock reduces on save; negative stock allowed and flagged; payment label; draft recovery after crash; scenarios 1 to 8 pass; 5-line bill under 60 s measured |
| M4 | 1 to 14 Feb | **Bills and print (US2 and US3)** | Receipt and A4/A5 layout match `contracts/bill-layout.md`; PDF export; print failure never blocks save; bill list search by number, date and customer; reprint identical; cancel with reason restores stock and keeps number; saved bills cannot be edited or deleted |
| M5 | 15 to 28 Feb | **Import, backup, packaging** | Spreadsheet import with error and duplicate preview and nothing saved until confirmed; automatic backup to a second folder tested with a real restore on a clean machine; signed or notarized installer for Mac and unsigned for Windows; settings screen done; written restore guide |
| M6 | 1 to 14 Mar | **Shop trial** | Installed at the counter and used for real bills alongside the paper book for 2 weeks; zero lost or duplicated bills; stock check on 20 items matches (SC-005); 20-bill total check matches (SC-007); top 3 complaints fixed; go or no-go to retire the paper bill book |

**Buffer**: 2 weeks of slack are left after M6 (to about 28 Mar) before starting the next feature (tax, khata, then sync); the PRD's go-live date of 1 June 2027 is not at risk from this MVP.

**Risks and fallbacks**
- Thermal printing on Electron is unreliable: fall back to the OS print dialog with a receipt-width stylesheet, and defer raw ESC/POS to a later milestone.
- SQLCipher build is troublesome in Electron: ship unencrypted with OS disk encryption advised, keep the key hook, revisit before cloud backup.
- Item data is dirty: the import preview and duplicate warning are in M5, but clean-up work starts in M-1.

## Complexity Tracking

No constitution violations. Two workspace packages is the only structure beyond a single project, and it is justified by the architecture requirement that rules be shared with a future server and phone apps.
