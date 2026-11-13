---
description: "Task list for Shop OS MVP (Inventory + Basic Bill)"
---

# Tasks: Shop OS MVP (Inventory + Basic Bill)

**Input**: Design documents from `/specs/001-shop-os-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, contracts/bill-layout.md, quickstart.md

**Tests**: Included. The plan commits to Vitest for core and service logic and Playwright for Electron end-to-end scenarios (quickstart.md), and the milestone exit criteria depend on them. Within each story, write the tests first and confirm they fail before implementing.

**Organization**: Grouped by user story (US1 inventory, US2 basic bill, US3 find/reprint/cancel). Import, backup, packaging and the shop trial are cross-cutting and come last. Milestone references (M0 to M6) are from plan.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1, US2 or US3
- All paths are relative to the repository root. `core` = `packages/core`, `desktop` = `apps/desktop`.

---

## Phase 1: Setup (M0, 7 to 13 Dec 2026)

**Purpose**: Repository, tooling and a proven packaged skeleton.

- [ ] T001 Create the pnpm workspace: `package.json`, `pnpm-workspace.yaml` listing `packages/*` and `apps/*`, `.gitignore` (node_modules, dist, release, *.sqlite, backups), `.nvmrc` with Node 22, and `tsconfig.base.json` with `strict: true`
- [ ] T002 [P] Create `packages/core` with `package.json` (name `@shopos/core`, no runtime dependencies except Zod), `tsconfig.json`, empty `src/index.ts` exporting nothing yet, and a Vitest config in `packages/core/vitest.config.ts`
- [ ] T003 [P] Create `apps/desktop` with Electron, React 18, Vite and TypeScript: `apps/desktop/package.json`, `electron.vite.config.ts` (or equivalent), `src/main/index.ts` opening one window, `src/preload/index.ts`, and `src/renderer/index.html` plus `src/renderer/main.tsx` rendering "Shop OS"
- [ ] T004 [P] Configure ESLint and Prettier at the repo root (`eslint.config.js`, `.prettierrc`) and add root scripts `lint`, `format`, `test`, `test:e2e`, `dev`, `build` in `package.json`
- [ ] T005 Set Electron window security defaults in `apps/desktop/src/main/index.ts`: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, preload path set, and a restrictive Content-Security-Policy meta tag in `apps/desktop/src/renderer/index.html`
- [ ] T006 Install better-sqlite3 and Drizzle (`drizzle-orm`, `drizzle-kit`) in `apps/desktop`; configure the native-module rebuild for Electron and `asarUnpack` for better-sqlite3 in `apps/desktop/electron-builder.yml`; record the exact working steps in `specs/001-shop-os-mvp/research.md` under D3 (this resolves the M0 open item)
- [ ] T007 Spike: open a SQLite database in the main process in a **packaged** build (`pnpm --filter desktop build` then run the packaged app), create a table, insert a row and read it back; write the result in `specs/001-shop-os-mvp/research.md`
- [ ] T008 Spike: print a test page to the shop's real printer from the packaged app via the OS print dialog at receipt width, and export a test PDF with `printToPDF`; record printer model, paper width and result in `specs/001-shop-os-mvp/research.md` under D9
- [ ] T009 Spike: try a SQLCipher-capable better-sqlite3 build in the packaged app; record "encrypted now" or "deferred" in `specs/001-shop-os-mvp/research.md` under D4

**Checkpoint (M0 exit)**: App boots; SQLite works when packaged; a real print and PDF succeed; encryption decision written.

---

## Phase 2: Foundational (M1, 14 to 27 Dec 2026)

**Purpose**: Core rules, schema and plumbing that every story needs. No user story starts until this is done.

### Core package (pure TypeScript, no Electron or database imports)

- [ ] T010 [P] Write tests first in `packages/core/tests/money.test.ts`: paise add/subtract, percent discount rounds to the nearest paisa half up, formatting with Indian grouping (`₹1,00,000.00`), rejection of non-integer paise
- [ ] T011 [P] Write tests first in `packages/core/tests/quantity.test.ts`: thousandths arithmetic; units `pcs`, `metre`, `kg`, `litre`, `box`, custom; "decimal allowed" defaults (on for metre, kg, litre; off otherwise); `pcs` rejects 2.5; metre accepts 2.5; display trims trailing zeros (2.5 not 2.500)
- [ ] T012 [P] Write tests first in `packages/core/tests/billing.test.ts`: line amount = quantity times rate (rounded half up) minus line discount; lines total; bill discount between 0 and lines total; grand total = lines total minus bill discount; invalid discount rejected; 20-bill reference set matching manual calculation
- [ ] T013 [P] Write tests first in `packages/core/tests/stock.test.ts`: fold movements into stock; negative stock detected; sum-of-movements invariant check function; sale and `sale_cancel` movements cancel out exactly
- [ ] T014 [P] Write tests first in `packages/core/tests/numbering.test.ts`: bill number built from template, series and financial year; financial year runs 1 April to 31 March; number is at most 16 characters; reject a template that can exceed 16 characters
- [ ] T015 [P] Implement `packages/core/src/money.ts` to pass T010
- [ ] T016 [P] Implement `packages/core/src/quantity.ts` to pass T011
- [ ] T017 Implement `packages/core/src/billing.ts` to pass T012 (depends on T015, T016)
- [ ] T018 [P] Implement `packages/core/src/stock.ts` to pass T013
- [ ] T019 [P] Implement `packages/core/src/numbering.ts` to pass T014
- [ ] T020 [P] Define shared types and Zod schemas in `packages/core/src/types.ts` for every command in `specs/001-shop-os-mvp/contracts/ipc-commands.md` (inputs, results, error codes) and export everything from `packages/core/src/index.ts`

### Database and plumbing

- [ ] T021 Define the Drizzle schema in `apps/desktop/src/main/db/schema.ts` for `item`, `stock_movement`, `bill`, `bill_line`, `shop_profile`, `number_counter`, `draft_bill`, `backup_log` exactly as in `specs/001-shop-os-mvp/data-model.md`. Every table: `id` UUID v7 text primary key; `business_id` and `shop_id` UUID text not null; `created_at` and `updated_at` ISO-8601 UTC text not null. Quote and enforce these constraints: item `name` text not null, 1-120 characters, trimmed; item `unit` not null, up to 20 characters for custom; item `price_paise` integer not null, 0 or more; bill `payment_mode` one of `cash`, `upi`, `card`, `unpaid`; bill `status` `saved` or `cancelled`; `cancel_reason` required when cancelled; `stock_movement.reason` one of `opening`, `adjustment`, `sale`, `sale_cancel`; `stock_movement.quantity_milli` non-zero; bill line `quantity_milli` greater than 0
- [ ] T022 Add the reserved nullable columns `hsn`, `gst_rate_bp`, `barcode` to `item` in `apps/desktop/src/main/db/schema.ts` and the indexes listed in data-model.md (item name NOCASE, `stock_movement(item_id, occurred_at)`, `bill(number)` unique, `bill(bill_date)`, `bill(customer_name)`, `bill_line(bill_id)`)
- [ ] T023 Generate the first migration with drizzle-kit into `apps/desktop/drizzle/` and add `apps/desktop/src/main/db/connection.ts` that opens the database file in the OS user-data folder, sets WAL mode and `foreign_keys = ON`, runs pending migrations on startup, and has a single place to supply an encryption key (no key used yet)
- [ ] T024 [P] Add `apps/desktop/src/main/db/ids.ts` generating UUID v7 ids and a `device_id` persisted in the database on first run; add a first-run seed that creates the single business, the single shop and a default `shop_profile` row in `apps/desktop/src/main/db/seed.ts`
- [ ] T025 [P] Create the repository layer shells in `apps/desktop/src/main/repositories/` (`ItemRepository.ts`, `StockRepository.ts`, `BillRepository.ts`, `SettingsRepository.ts`), each taking a database handle and always setting `business_id`, `shop_id`, `id`, timestamps
- [ ] T026 Add a test helper `apps/desktop/tests/helpers/testDb.ts` that creates an in-memory SQLite database with all migrations applied, for integration tests
- [ ] T027 Build the command bridge: `apps/desktop/src/main/ipc/index.ts` registering handlers that validate input with the Zod schemas from T020 and return `{ ok: true, data }` or `{ ok: false, code, message }`; expose a typed `window.shopos` API in `apps/desktop/src/preload/index.ts` with only the commands in the contract
- [ ] T028 [P] Install Radix UI in `apps/desktop` (`@radix-ui/themes` and `radix-ui`), wrap the app in the Radix `Theme` provider with its stylesheet imported in `apps/desktop/src/renderer/main.tsx`, and create the app shell in `apps/desktop/src/renderer/`: `App.tsx` with a left navigation (Items, New bill, Bills, Settings), a router, a global error toast in `components/Toast.tsx` using the Radix Toast primitive, and keyboard focus styles with large tap targets and visible text contrast (no colour-only status). Use Radix components for every table, dialog, select, tab and toast in later tasks.
- [ ] T029 Run `pnpm test` and verify core tests pass and the shell opens with an empty database

**Checkpoint (M1 exit)**: Core rules fully tested; schema migrates; stock folding matches a reference on 20 sample items.

---

## Phase 3: User Story 1 - Enter inventory (Priority: P1) 🎯 (M2, 28 Dec 2026 to 10 Jan 2027)

**Goal**: Owner or staff add, edit, deactivate and search items and correct stock; every stock change is recorded.

**Independent Test**: Add 10 items, edit one, adjust one, search "pip", try a duplicate name and a decimal on pcs; stock shown is correct after each step (quickstart scenario 1).

### Tests for User Story 1 (write first, confirm they fail)

- [ ] T030 [P] [US1] Integration tests in `apps/desktop/tests/integration/inventory.test.ts`: create item writes an `opening` movement and sets `stock_milli`; duplicate name (case-insensitive) returns `DUPLICATE_NAME` with the matching items; `pcs` with 2.5 returns `INVALID_QUANTITY`; metre with 2.5 succeeds; adjust "add" and "set" write movements; `NOTE_REQUIRED` when the adjustment note is empty; deactivated item stays queryable; invariant: stock equals sum of movements
- [ ] T031 [P] [US1] End-to-end test in `apps/desktop/tests/e2e/inventory.spec.ts` following quickstart scenario 1 (Playwright for Electron)

### Implementation for User Story 1

- [ ] T032 [P] [US1] Implement `ItemRepository` methods (create, update, get, search by partial name with prefix and substring matching, list with `includeInactive` and `needsCorrection`) in `apps/desktop/src/main/repositories/ItemRepository.ts`
- [ ] T033 [P] [US1] Implement `StockRepository.append(movement)` and `StockRepository.sumForItem(itemId)` in `apps/desktop/src/main/repositories/StockRepository.ts`; movements are insert-only, no update or delete method exists
- [ ] T034 [US1] Implement `InventoryService` in `apps/desktop/src/main/services/InventoryService.ts`: `createItem` (validate with core, check duplicates, insert item and `opening` movement in one transaction), `updateItem`, `adjustStock` (add or set; `set` writes the difference; note required), `listItems`; reuse core `quantity.ts` for decimal rules (depends on T032, T033)
- [ ] T035 [US1] Wire the commands `items.list`, `items.create`, `items.update`, `stock.adjust` in `apps/desktop/src/main/ipc/inventory.ts` (depends on T034)
- [ ] T036 [P] [US1] Build the Items screen in `apps/desktop/src/renderer/screens/ItemsScreen.tsx`: searchable table (name, unit, price, stock), filter "Needs correction" for negative stock, "Show inactive" toggle, stock shown with units and a text label (not colour only) for negative
- [ ] T037 [P] [US1] Build the Item form in `apps/desktop/src/renderer/screens/ItemForm.tsx`: name, unit picker with custom unit, decimal allowed (defaulted by unit), price in rupees converted to paise, opening quantity; shows the duplicate warning list before saving; keyboard friendly
- [ ] T038 [P] [US1] Build the Adjust stock dialog in `apps/desktop/src/renderer/components/AdjustStockDialog.tsx`: add or set, quantity, required note
- [ ] T039 [US1] Connect the screens to the commands through a small data layer in `apps/desktop/src/renderer/state/items.ts`; make T030 and T031 pass
- [ ] T040 [US1] Measure and record search time with 5,000 generated items in `apps/desktop/tests/integration/searchPerf.test.ts` (target under 0.5 s; spec SC-003) and add the prefix or FTS index if it fails

**Checkpoint (M2 exit)**: Spec US1 scenarios 1 to 6 pass in the end-to-end test.

---

## Phase 4: User Story 2 - Generate a basic bill (Priority: P1) (M3, 11 to 31 Jan 2027)

**Goal**: Staff create, save and print a no-tax bill; stock reduces; numbers are sequential; drafts survive a crash.

**Independent Test**: Quickstart scenarios 2, 3 and 4: 3 items, a rate change, a discount, save; totals match manual calculation; stock fell; negative stock allowed and flagged; draft recovered after force-quit.

### Tests for User Story 2 (write first)

- [ ] T041 [P] [US2] Integration tests in `apps/desktop/tests/integration/billing.test.ts`: save writes bill, lines, one `sale` movement per line and updates stock in one transaction; failure mid-save leaves nothing behind; `EMPTY_BILL`, zero or negative quantity, discount larger than the line amount and inactive item are rejected; numbers are sequential and unique across 50 quick saves; selling more than stock succeeds and reports `negativeStockItems`; line snapshots keep item name and unit; payment mode label stored
- [ ] T042 [P] [US2] End-to-end test in `apps/desktop/tests/e2e/billing.spec.ts` following quickstart scenarios 2 to 4, including a force-quit before save (draft offered) and after save (bill present exactly once)

### Implementation for User Story 2

- [ ] T043 [P] [US2] Implement `BillRepository.insertBill` and `insertLines` and `NumberCounter` increment in `apps/desktop/src/main/repositories/BillRepository.ts` (insert-only; no update or delete for saved bills except the cancel fields, added in US3)
- [ ] T044 [P] [US2] Implement `SettingsRepository` get and update for the shop profile in `apps/desktop/src/main/repositories/SettingsRepository.ts` (name required up to 80, address up to 200, phone up to 20, series code, number template, footer up to 200, receipt width `58mm` or `80mm`)
- [ ] T045 [US2] Implement `BillingService.saveBill` in `apps/desktop/src/main/services/BillingService.ts`: validate with core `billing.ts`, take the next sequence from `number_counter` for the series and financial year, build the number with core `numbering.ts`, insert bill, lines and `sale` movements, update cached item stock, all in one database transaction; return the saved bill and `negativeStockItems` (depends on T043, T044)
- [ ] T046 [US2] Implement draft handling (`bills.draft.save`, `bills.draft.load`, clear on save) in `apps/desktop/src/main/services/BillingService.ts` and `apps/desktop/src/main/ipc/billing.ts`
- [ ] T047 [US2] Wire `bills.save`, `settings.get`, `settings.update` in `apps/desktop/src/main/ipc/billing.ts` and `apps/desktop/src/main/ipc/settings.ts`
- [ ] T048 [US2] Build the New bill screen in `apps/desktop/src/renderer/screens/NewBillScreen.tsx`: search box focused on open; 2+ characters shows matches; Enter adds the top match at quantity 1; editable quantity and rate per line; per-line and whole-bill discount as rupees or percent; running totals from core `billing.ts`; optional customer name and phone; payment mode picker (cash, UPI, card, unpaid, label only); remove line; Save with Ctrl or Cmd+S
- [ ] T049 [P] [US2] Build the line editor in `apps/desktop/src/renderer/components/BillLineRow.tsx` with decimal rules from core `quantity.ts` and inline error text
- [ ] T050 [P] [US2] Build the Settings screen in `apps/desktop/src/renderer/screens/SettingsScreen.tsx` for the shop profile fields and the bill number template with a live preview and a warning if the number could exceed 16 characters
- [ ] T051 [US2] Autosave the in-progress bill to the draft after every change in `apps/desktop/src/renderer/state/billDraft.ts` and offer recovery on app start; make T041 and T042 pass
- [ ] T052 [US2] After a successful save, show the saved bill with "Print", "Save PDF" and "New bill" actions in `apps/desktop/src/renderer/screens/BillView.tsx` (printing is built in US3 T060 to T062; until then the buttons are disabled)

**Checkpoint (M3 exit)**: Spec US2 scenarios 1 to 8 pass; a 5-line bill is made in 60 seconds or less (spec SC-002), timed and recorded in `specs/001-shop-os-mvp/quickstart.md`.

---

## Phase 5: User Story 3 - Find, reprint and cancel bills (Priority: P2) (M4, 1 to 14 Feb 2027)

**Goal**: Print and export bills to the layout contract; list and search bills; reprint identically; cancel with a reason restoring stock.

**Independent Test**: Quickstart scenario 5.

### Tests for User Story 3 (write first)

- [ ] T053 [P] [US3] Integration tests in `apps/desktop/tests/integration/billCancel.test.ts`: cancel requires a reason; cancel writes one `sale_cancel` movement per line equal and opposite to the sale; stock returns to the pre-sale value; cancelled number is never reused (next bill gets the next sequence); second cancel returns `ALREADY_CANCELLED`; no repository method edits or deletes saved bills, lines or movements
- [ ] T054 [P] [US3] Unit tests in `apps/desktop/tests/unit/billLayout.test.ts`: the rendered HTML for a bill contains the header, lines, totals and footer from `specs/001-shop-os-mvp/contracts/bill-layout.md`, shows no tax wording, hides zero discounts, trims quantity decimals, and shows the CANCELLED banner with the reason when cancelled
- [ ] T055 [P] [US3] End-to-end test in `apps/desktop/tests/e2e/bills.spec.ts` following quickstart scenario 5

### Implementation for User Story 3

- [ ] T056 [P] [US3] Implement `BillRepository.list` (filter by number, date range, customer, status; paging) and `get` in `apps/desktop/src/main/repositories/BillRepository.ts`
- [ ] T057 [US3] Implement `BillingService.cancelBill` in `apps/desktop/src/main/services/BillingService.ts`: one transaction that sets status `cancelled`, `cancel_reason` and `cancelled_at`, appends the reverse `sale_cancel` movements and restores cached stock; refuse if already cancelled or reason empty
- [ ] T058 [US3] Wire `bills.list`, `bills.get`, `bills.cancel` in `apps/desktop/src/main/ipc/billing.ts`
- [ ] T059 [P] [US3] Build the Bills screen in `apps/desktop/src/renderer/screens/BillsScreen.tsx`: search by number, date range and customer; status shown as text "Cancelled"; open a bill
- [ ] T060 [P] [US3] Implement the bill renderer in `apps/desktop/src/main/services/billHtml.ts` producing HTML from a bill, lines and shop profile per `contracts/bill-layout.md`, with print stylesheets for `58mm`, `80mm`, A4 and A5, using only snapshot values and core money formatting
- [ ] T061 [US3] Implement `PrintService` in `apps/desktop/src/main/services/PrintService.ts`: print through the OS dialog for the chosen target and export PDF with `printToPDF`; a print or export failure returns `PRINT_FAILED` or `WRITE_FAILED` and never touches the saved bill (depends on T060)
- [ ] T062 [US3] Wire `bills.print` and `bills.exportPdf` in `apps/desktop/src/main/ipc/billing.ts` and enable the Print and Save PDF buttons in `apps/desktop/src/renderer/screens/BillView.tsx`
- [ ] T063 [US3] Add the Cancel bill action with a required reason dialog in `apps/desktop/src/renderer/components/CancelBillDialog.tsx`; saved bills show no edit or delete controls anywhere; make T053 to T055 pass
- [ ] T064 [US3] Verify the 80 mm receipt on the real printer with a 5-line bill and a long item name (spike T008 settings) and record the result in `specs/001-shop-os-mvp/quickstart.md`

**Checkpoint (M4 exit)**: Reprint identical; cancel restores stock; layout matches the contract on the real printer.

---

## Phase 6: Import, backup, packaging (M5, 15 to 28 Feb 2027)

**Purpose**: Spec FR-007 (import), FR-019 (shop profile, done in T050), FR-020 (offline), FR-021 (backup), and a shippable installer. Not tied to one story.

- [ ] T065 [P] Integration tests in `apps/desktop/tests/integration/import.test.ts`: file with valid rows, rows missing a unit or price, non-numeric quantity, and duplicate names (against existing items and within the file); preview saves nothing; commit inserts all rows and their `opening` movements in one transaction; a failed commit leaves nothing behind
- [ ] T066 [P] Implement `ImportService` in `apps/desktop/src/main/services/ImportService.ts` using exceljs to read xlsx and csv with columns name, unit, price, quantity; `preview` returns rows, errors and duplicates with a short-lived `previewId`; `commit` applies the preview
- [ ] T067 Wire `import.preview` and `import.commit` in `apps/desktop/src/main/ipc/import.ts` and build the Import screen in `apps/desktop/src/renderer/screens/ImportScreen.tsx` (choose file, review error and duplicate lists, confirm); add a downloadable sample file `apps/desktop/resources/items-sample.xlsx`
- [ ] T068 [P] Integration tests in `apps/desktop/tests/integration/backup.test.ts`: backup produces a file that opens and contains the same items and bills; backup while a bill is being saved is consistent; retention keeps the last 30 daily copies; restore replaces the database with the chosen file; a corrupt file returns `INVALID_BACKUP`
- [ ] T069 Implement `BackupService` in `apps/desktop/src/main/services/BackupService.ts` using better-sqlite3 `db.backup()` (verify the exact call in the better-sqlite3 documentation first) to write timestamped copies to the configured second folder on app close and every 15 minutes while the app is open, record each attempt in `backup_log`, prune to the last 30 daily copies
- [ ] T070 Wire `backup.run`, `backup.status`, `backup.restore` in `apps/desktop/src/main/ipc/backup.ts` and add a Backup section (folder chooser, last good backup time, Run now, Restore from file, visible failure message) to `apps/desktop/src/renderer/screens/SettingsScreen.tsx`
- [ ] T071 Configure packaging in `apps/desktop/electron-builder.yml` for macOS (signed and notarized if an Apple developer account is available, otherwise unsigned with documented first-run steps), Windows and Linux; verify the packaged app runs the whole quickstart on a clean machine
- [ ] T072 Write the owner-facing restore guide in `docs/restore-guide.md`: where the data and backups live, how to restore on a new computer, how to check the last backup; test it by having someone other than the builder follow it on a clean machine and fix what they get stuck on
- [ ] T073 Verify offline behavior: run every quickstart scenario with networking disabled and confirm nothing depends on the internet (spec FR-020)

**Checkpoint (M5 exit)**: Import preview and commit work; a restore on a clean machine succeeds; installer builds.

---

## Phase 7: Polish and shop trial (M6, 1 to 14 Mar 2027)

- [ ] T074 [P] Add a "Needs correction" badge and count on the Items nav entry in `apps/desktop/src/renderer/App.tsx`
- [ ] T075 [P] Add keyboard shortcut help (new bill, save, print, search focus) in `apps/desktop/src/renderer/components/ShortcutHelp.tsx`
- [ ] T076 [P] Accessibility pass across `apps/desktop/src/renderer/`: tap target sizes, text contrast, labels on every field, no information by colour alone
- [ ] T077 Run the full verification in `specs/001-shop-os-mvp/quickstart.md` scenarios 1 to 6 on the packaged build and record results
- [ ] T078 Install at the counter and run the 2-week trial next to the paper bill book; log defects and the top 3 complaints in `docs/trial-log.md`; fix the top 3
- [ ] T079 Trial checks recorded in `docs/trial-log.md`: no lost or duplicated bills (spec SC-004); stock after bills and cancels equals opening plus adjustments minus net sales on 20 items (SC-005); 20 bills match manual totals (SC-007); a 5-line bill takes 60 seconds or less (SC-002); a new staff member bills 5 lines unaided after 30 minutes (SC-006)
- [ ] T080 Go or no-go decision on retiring the paper bill book, written in `docs/trial-log.md`

---

## Dependencies and execution order

- **Phase 1** (T001 to T009) first. T002 to T004 can run in parallel after T001. T006 to T009 are spikes that gate the rest.
- **Phase 2** (T010 to T029) blocks all stories. Core tests T010 to T014 run in parallel; implementations T015, T016, T018, T019, T020 run in parallel; T017 waits for T015 and T016. T021 to T023 are sequential; T024 to T026 and T028 are parallel after T023.
- **US1** (Phase 3) can start as soon as Phase 2 ends. **US2** (Phase 4) needs items to exist, so it follows US1's repositories and services (T032 to T034) but its tests and bill repository (T041 to T044) can start earlier. **US3** (Phase 5) needs US2's saved bills.
- **Phase 6** can start once US1 is done for import (T065 to T067) and once Phase 2 is done for backup (T068 to T070); packaging (T071) needs all stories.
- **Phase 7** last.

## Parallel examples

- Phase 2: T010 to T014 together, then T015, T016, T018, T019, T020 together.
- US1: T030 with T031; then T032 with T033; then T036, T037, T038 together.
- US2: T041 with T042; T043 with T044; T049 with T050.
- US3: T053, T054, T055 together; T056 with T059 and T060.

## Implementation strategy

1. **MVP first**: Phases 1 and 2, then US1 and US2 (M0 to M3) give a working inventory and billing system. Stop and demo at the end of US2.
2. Add US3 (bill list, print, cancel) and Phase 6 (import, backup, installer) before the shop trial.
3. Do not start tax, khata or other PRD modules until the trial go or no-go (T080).

## Format validation

Every task above starts with `- [ ]`, has a sequential ID (T001 to T080), carries a story label only inside the three story phases, and names exact file paths. Tasks marked [P] touch different files and have no dependency on an unfinished task.
