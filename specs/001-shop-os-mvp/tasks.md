---
description: "MVP-only task list for Shop OS (Inventory + Basic Bill with print, plus backup)"
---

# Tasks: Shop OS MVP (Inventory + Basic Bill) - MVP scope only

**Input**: Design documents from `/specs/001-shop-os-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, contracts/bill-layout.md, quickstart.md

**Implementation status**: Code for T001-T063 is written and the app has been run. Items marked [X] are verified by passing unit/integration tests, typecheck, lint, build, or the three Playwright specs (`pnpm test:e2e`) run against real Electron 33. Items still [ ] carry a status note: mainly the real printer, the packaged installer and a second person following the restore guide.

**Tests**: Included. The plan commits to Vitest for core and service logic and Playwright for Electron end-to-end scenarios (quickstart.md), and the milestone exit criteria depend on them. Within each story, write the tests first and confirm they fail before implementing.

**Organization**: MVP scope = US1 (inventory) + US2 (basic bill, saved, printed, PDF) + US3 (bill list, reprint, cancel; moved back into the first release on 2026-11-13, review B3) + automatic backup (FR-021) + a packaged build. Spreadsheet import (FR-007) and the formal shop trial remain deferred; the full 80-task list is kept in `tasks.full.md` for reference only. Milestone references (M0 to M6) are from plan.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1, US2 or US3
- All paths are relative to the repository root. `core` = `packages/core`, `desktop` = `apps/desktop`.

---

## Phase 1: Setup (M0, 7 to 13 Dec 2026)

**Purpose**: Repository, tooling and a proven packaged skeleton.

- [X] T001 Create the pnpm workspace: `package.json`, `pnpm-workspace.yaml` listing `packages/*` and `apps/*`, `.gitignore` (node_modules, dist, release, *.sqlite, backups), `.nvmrc` with Node 22, and `tsconfig.base.json` with `strict: true`
- [X] T002 [P] Create `packages/core` with `package.json` (name `@shopos/core`, no runtime dependencies except Zod), `tsconfig.json`, empty `src/index.ts` exporting nothing yet, and a Vitest config in `packages/core/vitest.config.ts`
- [X] T003 [P] Create `apps/desktop` with Electron, React 18, Vite and TypeScript: `apps/desktop/package.json`, `electron.vite.config.ts` (or equivalent), `src/main/index.ts` opening one window, `src/preload/index.ts`, and `src/renderer/index.html` plus `src/renderer/main.tsx` rendering "Shop OS"
- [X] T004 [P] Configure ESLint and Prettier at the repo root (`eslint.config.js`, `.prettierrc`) and add root scripts `lint`, `format`, `test`, `test:e2e`, `dev`, `build` in `package.json`
- [X] T005 Set Electron window security defaults in `apps/desktop/src/main/index.ts`: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, preload path set, and a restrictive Content-Security-Policy meta tag in `apps/desktop/src/renderer/index.html`
- [ ] T006 Install better-sqlite3 and Drizzle (`drizzle-orm`, `drizzle-kit`) in `apps/desktop`; configure the native-module rebuild for Electron and `asarUnpack` for better-sqlite3 in `apps/desktop/electron-builder.yml`; record the exact working steps in `specs/001-shop-os-mvp/research.md` under D3 (this resolves the M0 open item) **(Status: better-sqlite3 prebuilt for Electron 33 loads and runs; `electron-builder.yml` written; the electron-builder rebuild and packaged run are NOT verified)**
- [ ] T007 Spike: open a SQLite database in the main process in a **packaged** build (`pnpm --filter desktop build` then run the packaged app), create a table, insert a row and read it back; write the result in `specs/001-shop-os-mvp/research.md` **(Status: partly done: SQLite opens and migrates inside real Electron 33 (unpackaged, verified by the Playwright specs); the PACKAGED build is NOT tried)**
- [ ] T008 Spike: print a test page to the shop's real printer from the packaged app via the OS print dialog at receipt width, and export a test PDF with `printToPDF`; record printer model, paper width and result in `specs/001-shop-os-mvp/research.md` under D9 **(Status: NOT run: needs a real printer and a runnable app)**
- [ ] T009 Spike: try a SQLCipher-capable better-sqlite3 build in the packaged app; record "encrypted now" or "deferred" in `specs/001-shop-os-mvp/research.md` under D4 **(Status: NOT run: SQLCipher deferred, key hook left in connection.ts)**

**Checkpoint (M0 exit)**: App boots; SQLite works when packaged; a real print and PDF succeed; encryption decision written.

---

## Phase 2: Foundational (M1, 14 to 27 Dec 2026)

**Purpose**: Core rules, schema and plumbing that every story needs. No user story starts until this is done.

### Core package (pure TypeScript, no Electron or database imports)

- [X] T010 [P] Write tests first in `packages/core/tests/money.test.ts`: paise add/subtract, percent discount rounds to the nearest paisa half up, formatting with Indian grouping (`₹1,00,000.00`), rejection of non-integer paise
- [X] T011 [P] Write tests first in `packages/core/tests/quantity.test.ts`: thousandths arithmetic; units `pcs`, `metre`, `kg`, `litre`, `box`, custom; "decimal allowed" defaults (on for metre, kg, litre; off otherwise); `pcs` rejects 2.5; metre accepts 2.5; display trims trailing zeros (2.5 not 2.500)
- [X] T012 [P] Write tests first in `packages/core/tests/billing.test.ts`: line amount = quantity times rate (rounded half up) minus line discount; lines total; bill discount between 0 and lines total; grand total = lines total minus bill discount; invalid discount rejected; 20-bill reference set matching manual calculation
- [X] T013 [P] Write tests first in `packages/core/tests/stock.test.ts`: fold movements into stock; negative stock detected; sum-of-movements invariant check function; sale and `sale_cancel` movements cancel out exactly
- [X] T014 [P] Write tests first in `packages/core/tests/numbering.test.ts`: bill number built from template, series and financial year; financial year runs 1 April to 31 March; number is at most 16 characters; reject a template that can exceed 16 characters
- [X] T015 [P] Implement `packages/core/src/money.ts` to pass T010
- [X] T016 [P] Implement `packages/core/src/quantity.ts` to pass T011
- [X] T017 Implement `packages/core/src/billing.ts` to pass T012 (depends on T015, T016)
- [X] T018 [P] Implement `packages/core/src/stock.ts` to pass T013
- [X] T019 [P] Implement `packages/core/src/numbering.ts` to pass T014
- [X] T020 [P] Define shared types and Zod schemas in `packages/core/src/types.ts` for every command in `specs/001-shop-os-mvp/contracts/ipc-commands.md` (inputs, results, error codes) and export everything from `packages/core/src/index.ts`

### Database and plumbing

- [X] T021 Define the Drizzle schema in `apps/desktop/src/main/db/schema.ts` for `item`, `stock_movement`, `bill`, `bill_line`, `shop_profile`, `number_counter`, `draft_bill`, `backup_log` exactly as in `specs/001-shop-os-mvp/data-model.md`. Every table: `id` UUID v7 text primary key; `business_id` and `shop_id` UUID text not null; `created_at` and `updated_at` ISO-8601 UTC text not null. Quote and enforce these constraints: item `name` text not null, 1-120 characters, trimmed; item `unit` not null, up to 20 characters for custom; item `price_paise` integer not null, 0 or more; bill `payment_mode` one of `cash`, `upi`, `card`, `unpaid`; bill `status` `saved` or `cancelled`; `cancel_reason` required when cancelled; `stock_movement.reason` one of `opening`, `adjustment`, `sale`, `sale_cancel`; `stock_movement.quantity_milli` non-zero; bill line `quantity_milli` greater than 0
- [X] T022 Add the reserved nullable columns `hsn`, `gst_rate_bp`, `barcode` to `item` in `apps/desktop/src/main/db/schema.ts` and the indexes listed in data-model.md (item name NOCASE, `stock_movement(item_id, occurred_at)`, `bill(number)` unique, `bill(bill_date)`, `bill(customer_name)`, `bill_line(bill_id)`)
- [X] T023 Generate the first migration with drizzle-kit into `apps/desktop/drizzle/` and add `apps/desktop/src/main/db/connection.ts` that opens the database file in the OS user-data folder, sets WAL mode and `foreign_keys = ON`, runs pending migrations on startup, and has a single place to supply an encryption key (no key used yet)
- [X] T024 [P] Add `apps/desktop/src/main/db/ids.ts` generating UUID v7 ids and a `device_id` persisted in the database on first run; add a first-run seed that creates the single business, the single shop and a default `shop_profile` row in `apps/desktop/src/main/db/seed.ts`
- [X] T025 [P] Create the repository layer shells in `apps/desktop/src/main/repositories/` (`ItemRepository.ts`, `StockRepository.ts`, `BillRepository.ts`, `SettingsRepository.ts`), each taking a database handle and always setting `business_id`, `shop_id`, `id`, timestamps
- [X] T026 Add a test helper `apps/desktop/tests/helpers/testDb.ts` that creates an in-memory SQLite database with all migrations applied, for integration tests
- [X] T027 Build the command bridge: `apps/desktop/src/main/ipc/index.ts` registering handlers that validate input with the Zod schemas from T020 and return `{ ok: true, data }` or `{ ok: false, code, message }`; expose a typed `window.shopos` API in `apps/desktop/src/preload/index.ts` with only the commands in the contract
- [X] T028 [P] Install Radix UI in `apps/desktop` (`@radix-ui/themes` and `radix-ui`), wrap the app in the Radix `Theme` provider with its stylesheet imported in `apps/desktop/src/renderer/main.tsx`, and create the app shell in `apps/desktop/src/renderer/`: `App.tsx` with a left navigation (Items, New bill, Bills, Settings), a router, a global error toast in `components/Toast.tsx` using the Radix Toast primitive, and keyboard focus styles with large tap targets and visible text contrast (no colour-only status). Use Radix components for every table, dialog, select, tab and toast in later tasks.
- [X] T029 Run `pnpm test` and verify core tests pass and the shell opens with an empty database

**Checkpoint (M1 exit)**: Core rules fully tested; schema migrates; stock folding matches a reference on 20 sample items.

---

## Phase 3: User Story 1 - Enter inventory (Priority: P1) 🎯 (M2, 28 Dec 2026 to 10 Jan 2027)

**Goal**: Owner or staff add, edit, deactivate and search items and correct stock; every stock change is recorded.

**Independent Test**: Add 10 items, edit one, adjust one, search "pip", try a duplicate name and a decimal on pcs; stock shown is correct after each step (quickstart scenario 1).

### Tests for User Story 1 (write first, confirm they fail)

- [X] T030 [P] [US1] Integration tests in `apps/desktop/tests/integration/inventory.test.ts`: create item writes an `opening` movement and sets `stock_milli`; duplicate name (case-insensitive) returns `DUPLICATE_NAME` with the matching items; `pcs` with 2.5 returns `INVALID_QUANTITY`; metre with 2.5 succeeds; adjust "add" and "set" write movements; `NOTE_REQUIRED` when the adjustment note is empty; deactivated item stays queryable; invariant: stock equals sum of movements
- [X] T031 [P] [US1] End-to-end test in `apps/desktop/tests/e2e/inventory.spec.ts` following quickstart scenario 1 (Playwright for Electron)

### Implementation for User Story 1

- [X] T032 [P] [US1] Implement `ItemRepository` methods (create, update, get, search by partial name with prefix and substring matching, list with `includeInactive` and `needsCorrection`) in `apps/desktop/src/main/repositories/ItemRepository.ts`
- [X] T033 [P] [US1] Implement `StockRepository.append(movement)` and `StockRepository.sumForItem(itemId)` in `apps/desktop/src/main/repositories/StockRepository.ts`; movements are insert-only, no update or delete method exists
- [X] T034 [US1] Implement `InventoryService` in `apps/desktop/src/main/services/InventoryService.ts`: `createItem` (validate with core, check duplicates, insert item and `opening` movement in one transaction), `updateItem`, `adjustStock` (add or set; `set` writes the difference; note required), `listItems`; reuse core `quantity.ts` for decimal rules (depends on T032, T033)
- [X] T035 [US1] Wire the commands `items.list`, `items.create`, `items.update`, `stock.adjust` in `apps/desktop/src/main/ipc/inventory.ts` (depends on T034)
- [X] T036 [P] [US1] Build the Items screen in `apps/desktop/src/renderer/screens/ItemsScreen.tsx`: searchable table (name, unit, price, stock), filter "Needs correction" for negative stock, "Show inactive" toggle, stock shown with units and a text label (not colour only) for negative
- [X] T037 [P] [US1] Build the Item form in `apps/desktop/src/renderer/screens/ItemForm.tsx`: name, unit picker with custom unit, decimal allowed (defaulted by unit), price in rupees converted to paise, opening quantity; shows the duplicate warning list before saving; keyboard friendly
- [X] T038 [P] [US1] Build the Adjust stock dialog in `apps/desktop/src/renderer/components/AdjustStockDialog.tsx`: add or set, quantity, required note
- [X] T039 [US1] Connect the screens to the commands through a small data layer in `apps/desktop/src/renderer/state/items.ts`; make T030 and T031 pass
- [X] T040 [US1] Measure and record search time with 5,000 generated items in `apps/desktop/tests/integration/searchPerf.test.ts` (target under 0.5 s; spec SC-003) and add the prefix or FTS index if it fails

**Checkpoint (M2 exit)**: Spec US1 scenarios 1 to 6 pass in the end-to-end test.

---

## Phase 4: User Story 2 - Generate a basic bill (Priority: P1) (M3, 11 to 31 Jan 2027)

**Goal**: Staff create, save and print a no-tax bill; stock reduces; numbers are sequential; drafts survive a crash.

**Independent Test**: Quickstart scenarios 2, 3 and 4: 3 items, a rate change, a discount, save; totals match manual calculation; stock fell; negative stock allowed and flagged; draft recovered after force-quit.

### Tests for User Story 2 (write first)

- [X] T041 [P] [US2] Integration tests in `apps/desktop/tests/integration/billing.test.ts`: save writes bill, lines, one `sale` movement per line and updates stock in one transaction; failure mid-save leaves nothing behind; `EMPTY_BILL`, zero or negative quantity, discount larger than the line amount and inactive item are rejected; numbers are sequential and unique across 50 quick saves; selling more than stock succeeds and reports `negativeStockItems`; line snapshots keep item name and unit; payment mode label stored
- [X] T042 [P] [US2] End-to-end test in `apps/desktop/tests/e2e/billing.spec.ts` following quickstart scenarios 2 to 4, including a force-quit before save (draft offered) and after save (bill present exactly once)

### Implementation for User Story 2

- [X] T043 [P] [US2] Implement `BillRepository.insertBill` and `insertLines` and `NumberCounter` increment in `apps/desktop/src/main/repositories/BillRepository.ts` (insert-only; no update or delete for saved bills except the cancel fields, added in US3)
- [X] T044 [P] [US2] Implement `SettingsRepository` get and update for the shop profile in `apps/desktop/src/main/repositories/SettingsRepository.ts` (name required up to 80, address up to 200, phone up to 20, series code, number template, footer up to 200, receipt width `58mm` or `80mm`)
- [X] T045 [US2] Implement `BillingService.saveBill` in `apps/desktop/src/main/services/BillingService.ts`: validate with core `billing.ts`, take the next sequence from `number_counter` for the series and financial year, build the number with core `numbering.ts`, insert bill, lines and `sale` movements, update cached item stock, all in one database transaction; return the saved bill and `negativeStockItems` (depends on T043, T044)
- [X] T046 [US2] Implement draft handling (`bills.draft.save`, `bills.draft.load`, clear on save) in `apps/desktop/src/main/services/BillingService.ts` and `apps/desktop/src/main/ipc/billing.ts`
- [X] T047 [US2] Wire `bills.save`, `settings.get`, `settings.update` in `apps/desktop/src/main/ipc/billing.ts` and `apps/desktop/src/main/ipc/settings.ts`
- [X] T048 [US2] Build the New bill screen in `apps/desktop/src/renderer/screens/NewBillScreen.tsx`: search box focused on open; 2+ characters shows matches; Enter adds the top match at quantity 1; editable quantity and rate per line; per-line and whole-bill discount as rupees or percent; running totals from core `billing.ts`; optional customer name; payment mode picker (cash, UPI, card, unpaid, label only); remove line; Save with Ctrl or Cmd+S
- [X] T049 [P] [US2] Build the line editor in `apps/desktop/src/renderer/components/BillLineRow.tsx` with decimal rules from core `quantity.ts` and inline error text
- [ ] T050 [P] [US2] Build the Settings screen in `apps/desktop/src/renderer/screens/SettingsScreen.tsx` for the shop profile fields and the bill number template with a live preview and a warning if the number could exceed 16 characters **(Status: code written, builds and typechecks; the Settings screen was not opened in a test)**
- [X] T051 [US2] Autosave the in-progress bill to the draft after every change in `apps/desktop/src/renderer/state/billDraft.ts` and offer recovery on app start; make T041 and T042 pass
- [X] T052 [US2] After a successful save, show the saved bill with "Print", "Save PDF" and "New bill" actions in `apps/desktop/src/renderer/screens/BillView.tsx` (buttons are wired in T055 to T057)

### Printing and PDF for User Story 2 (FR-015; pulled forward from US3 because the MVP bill must print)

- [X] T053 [P] [US2] Unit tests in `apps/desktop/tests/unit/billLayout.test.ts`: the rendered HTML for a bill contains the header, lines, totals and footer from `specs/001-shop-os-mvp/contracts/bill-layout.md`, shows no tax wording, hides zero discounts, and trims quantity decimals
- [X] T054 [P] [US2] Implement the bill renderer in `apps/desktop/src/main/services/billHtml.ts` producing HTML from a bill, lines and shop profile per `contracts/bill-layout.md`, with print stylesheets for `58mm`, `80mm`, A4 and A5, using only snapshot values (`item_name_snapshot`, `unit_snapshot`) and core money formatting; makes T053 pass
- [X] T055 [US2] Implement `PrintService` in `apps/desktop/src/main/services/PrintService.ts`: print through the OS dialog for the chosen target and export PDF with `printToPDF`; a failure returns `PRINT_FAILED` or `WRITE_FAILED` and never touches the saved bill (depends on T054)
- [X] T056 [US2] Add `BillRepository.get` in `apps/desktop/src/main/repositories/BillRepository.ts` and wire `bills.get`, `bills.print` (`target`: receipt, a4, a5) and `bills.exportPdf` in `apps/desktop/src/main/ipc/billing.ts`
- [ ] T057 [US2] Enable the Print and Save PDF buttons in `apps/desktop/src/renderer/screens/BillView.tsx`; if printing fails show an inline message and keep the bill saved (spec US2 scenario 7) **(Status: code written; the Print button and OS print dialog were never exercised; PDF export is proven through the command in tests/e2e/pdf.spec.ts)**
- [ ] T058 [US2] Verify the 80 mm receipt on the real printer with a 5-line bill and a long item name (settings from spike T008); record the result and the timed 5-line bill (SC-002) in `specs/001-shop-os-mvp/quickstart.md` **(Status: NOT done: needs the real printer)**

**Checkpoint (MVP US2 exit)**: Spec US2 scenarios 1 to 8 pass; a 5-line bill is created, saved and printed in 60 seconds or less (SC-002).

---

## Phase 5: Backup and packaging (MVP release gate)

**Purpose**: FR-021 (automatic backup, a MUST) and FR-020 (offline). Without a backup, a disk failure loses every bill, so this stays in the MVP.

- [X] T059 [P] Integration tests in `apps/desktop/tests/integration/backup.test.ts`: backup produces a file that opens and contains the same items and bills; backup while a bill is being saved is consistent; retention keeps the last 30 daily copies; restore replaces the database with the chosen file; a corrupt file returns `INVALID_BACKUP`
- [X] T060 Implement `BackupService` in `apps/desktop/src/main/services/BackupService.ts` using better-sqlite3 `db.backup()` (verify the exact call in the better-sqlite3 documentation first) to write timestamped copies to the configured second folder on app close and every 15 minutes while the app is open, record each attempt in `backup_log` (`path`, `started_at`, `finished_at`, `status` `ok` or `failed`, `error`), and prune to the last 30 daily copies
- [ ] T061 Wire `backup.run`, `backup.status`, `backup.restore` in `apps/desktop/src/main/ipc/backup.ts` and add a Backup section (folder chooser, last good backup time, Run now, Restore from file, visible failure message) to `apps/desktop/src/renderer/screens/SettingsScreen.tsx` **(Status: backend and IPC tested; the Backup section of Settings was not opened in a test)**
- [ ] T062 Configure packaging in `apps/desktop/electron-builder.yml` for macOS (unsigned with documented first-run steps if no Apple developer account), and verify the packaged app runs quickstart scenarios 1 to 4 on a clean machine with networking disabled **(Status: electron-builder.yml written; no installer built or run)**
- [ ] T063 Write the owner-facing restore guide in `docs/restore-guide.md`: where the data and backups live, how to restore on a new computer, how to check the last backup; have someone other than the builder follow it once **(Status: docs/restore-guide.md written; not yet followed by a second person)**

**Checkpoint (MVP exit)**: Inventory and billing work in the packaged app offline; a bill prints; a restore from backup succeeds.

---

## Phase 6: User Story 3 - Find, reprint and cancel bills (Priority: P2, in the first release) (M4)

**Goal**: Staff find any past bill, reprint it identically, and cancel a wrong bill with a reason so stock is restored and the number is never reused (spec FR-016, FR-017, FR-018; quickstart scenario 5).

**Independent Test**: Save a bill, find it by number, date range and customer name, reprint it, then cancel it with a reason and confirm stock returns, the bill shows as Cancelled, and its number is not reused.

### Tests for User Story 3 (write first)

- [ ] T064 [P] [US3] Integration tests in `apps/desktop/tests/integration/billCancel.test.ts`: cancel requires a non-empty reason (`REASON_REQUIRED`); cancel inserts one `sale_cancel` movement per line equal and opposite to the sale; item stock returns to its pre-sale value; the next saved bill gets the next sequence number (cancelled number never reused); a second cancel returns `ALREADY_CANCELLED`; the database refuses any other update or delete of a saved bill, bill line or movement
- [ ] T065 [P] [US3] Unit tests in `apps/desktop/tests/unit/billLayout.test.ts`: a cancelled bill renders a CANCELLED banner with the reason and keeps its number; a normal bill is unchanged
- [ ] T066 [P] [US3] End-to-end test in `apps/desktop/tests/e2e/bills.spec.ts` following quickstart scenario 5 (find by number, date range and customer name; reprint; cancel; stock restored)

### Implementation for User Story 3

- [ ] T067 [P] [US3] Implement `BillRepository.list` (filter by number, date range, customer name, status; newest first; paging with a maximum page size) in `apps/desktop/src/main/repositories/BillRepository.ts`
- [ ] T068 [US3] Implement `BillingService.cancelBill` in `apps/desktop/src/main/services/BillingService.ts`: one transaction that sets status `cancelled`, `cancel_reason` and `cancelled_at`, appends the reverse `sale_cancel` movements and restores cached item stock; refuse if already cancelled or the reason is empty (depends on T067)
- [ ] T069 [US3] Wire `bills.list` and `bills.cancel` in `apps/desktop/src/main/ipc/billing.ts` with the Zod schemas in `packages/core/src/types.ts` (contract: `specs/001-shop-os-mvp/contracts/ipc-commands.md`)
- [ ] T070 [P] [US3] Build the Bills screen in `apps/desktop/src/renderer/screens/BillsScreen.tsx`: search by number, date range and customer name; status shown as the word "Cancelled" (not colour alone); open a bill in the existing bill view
- [ ] T071 [US3] Add the Cancel bill action with a required-reason dialog in `apps/desktop/src/renderer/components/CancelBillDialog.tsx`, show the CANCELLED banner in `apps/desktop/src/renderer/screens/BillView.tsx` and `apps/desktop/src/main/services/billHtml.ts`; saved bills show no edit or delete controls anywhere; make T064 to T066 pass
- [ ] T072 [US3] Verify reprint is identical to the original and cancel restores stock on a real counter run; record the result in `specs/001-shop-os-mvp/quickstart.md` (scenario 5)

**Checkpoint (US3 exit)**: Spec US3 scenarios 1 to 3 pass; a wrong bill can be cancelled and the stock comes back.

---

## Dependencies and execution order

- **Phase 1** (T001 to T009) first. T002 to T004 can run in parallel after T001. T006 to T009 are spikes that gate the rest.
- **Phase 2** (T010 to T029) blocks all stories. Core tests T010 to T014 run in parallel; implementations T015, T016, T018, T019, T020 run in parallel; T017 waits for T015 and T016. T021 to T023 are sequential; T024 to T026 and T028 are parallel after T023.
- **US1** (Phase 3) starts when Phase 2 ends. **US2** (Phase 4) follows US1's repositories and services (T032 to T034); its tests and bill repository (T041 to T044) can start earlier. Printing tasks T053 to T058 follow T045 and T052.
- **Phase 5** backup (T059 to T061) needs only Phase 2; packaging (T062) and the guide (T063) need US1 and US2 done.

## Parallel examples

- Phase 2: T010 to T014 together, then T015, T016, T018, T019, T020 together.
- US1: T030 with T031; T032 with T033; then T036, T037, T038 together.
- US2: T041 with T042; T043 with T044; T049 with T050; T053 with T054.
- Phase 5: T059 can run alongside US2 work.

## Implementation strategy

1. Phases 1 and 2, then US1 and US2 including print (T001 to T058). Demo at the end of US2.
2. Backup and packaging (T059 to T063), then use the app at the counter.
3. US3 (T064 to T072): bill list, reprint and cancel. In the first release because, until cancel exists, a wrong bill cannot be undone in the app. Build it before the counter trial.
4. Still deferred (descriptions in `tasks.full.md`, items T065 to T067 and T074 to T080 there): spreadsheet import (FR-007); accessibility and shortcut polish; the formal 2-week trial with SC-004/005/006/007 checks.
5. Do not start tax, khata or other PRD modules before that.

## Format validation

Every task starts with `- [ ]`, has a sequential ID (T001 to T072), carries a story label only inside story phases, and names exact file paths.
