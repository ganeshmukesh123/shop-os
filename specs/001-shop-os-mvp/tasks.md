---
description: "MVP-only task list for Shop OS (Inventory + Basic Bill with print, plus backup)"
---

# Tasks: Shop OS MVP (Inventory + Basic Bill) - MVP scope only

**Input**: Design documents from `/specs/001-shop-os-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, contracts/bill-layout.md, quickstart.md

**Implementation status**: Code for T001-T063 is written and the app has been run. Items marked [X] are verified by passing unit/integration tests, typecheck, lint, build, or the three Playwright specs (`pnpm test:e2e`) run against real Electron (now ^43.8). Items still [ ] carry a status note: mainly the real printer, the packaged installer and a second person following the restore guide. Revised 2026-11-15 after the spec audit: file paths corrected to the code as it is (the IPC handlers live in `main/ipc/handlers.ts` and `index.ts`, start-up in `main/app/*`, the bridge in `preload/bridge.ts`), and Phase 7 (T073 to T090) added for the owner's decisions (research D18 to D23) and the design-compliance gaps.

**Tests**: Included. The plan commits to Vitest for core and service logic and Playwright for Electron end-to-end scenarios (quickstart.md), and the milestone exit criteria depend on them. Within each story, write the tests first and confirm they fail before implementing.

**Organization**: MVP scope = US1 (inventory) + US2 (basic bill, saved, printed, PDF) + US3 (bill list, reprint, cancel; moved back into the first release on 2026-11-13, review B3) + automatic backup (FR-021) + a packaged build. Spreadsheet import (FR-007) moved to feature 012 (owner decision 2026-11-15); the formal shop trial is M6. The old `tasks.full.md` has been removed; this file is the only task list. Milestone references (M0 to M6, M3b) are from plan.md.

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
- [X] T006 Install better-sqlite3 and Drizzle (`drizzle-orm`, `drizzle-kit`) in `apps/desktop`; configure the native-module rebuild for Electron and `asarUnpack` for better-sqlite3 in `apps/desktop/electron-builder.yml`; record the exact working steps in `specs/001-shop-os-mvp/research.md` under D3 (this resolves the M0 open item) **(Status 2026-11-15: done on macOS arm64. `pnpm --filter @shopos/desktop package` ran its better-sqlite3 rebuild step and produced the app and a DMG; the native module is unpacked from the asar and loads; steps are in research D3. NOT verified: Windows and Linux packaging, Mac Intel.)**
- [X] T007 Spike: open a SQLite database in the main process in a **packaged** build (`pnpm --filter desktop build` then run the packaged app), create a table, insert a row and read it back; write the result in `specs/001-shop-os-mvp/research.md` **(Status 2026-11-15: done on the packaged macOS arm64 app: `pnpm --filter @shopos/desktop test:e2e:packaged` (4 of 4, also with `--offline`) runs the specs against the packaged binary; `tests/e2e/packaged.spec.ts` asserts it is packaged, migrated, and holds a row written through the screen. Result in research D3.)**
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
- [X] T020 [P] Define shared types and Zod schemas in `packages/core/src/types.ts` for every command in `specs/001-shop-os-mvp/contracts/ipc-commands.md` (inputs, results, error codes) and export everything from `packages/core/src/index.ts` _(caveat 2026-11-15: done for every command except `bills.list` and `bills.cancel`, which are added in T069)_

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
- [X] T035 [US1] Wire the commands `items.list`, `items.create`, `items.update`, `stock.adjust` in `apps/desktop/src/main/ipc/handlers.ts` (depends on T034)
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
- [X] T046 [US2] Implement draft handling (`bills.draft.save`, `bills.draft.load`, clear on save) in `apps/desktop/src/main/services/BillingService.ts` and `apps/desktop/src/main/ipc/handlers.ts`
- [X] T047 [US2] Wire `bills.save`, `settings.get`, `settings.update` in `apps/desktop/src/main/ipc/handlers.ts` (settings through `apps/desktop/src/main/services/SettingsService.ts`)
- [X] T048 [US2] Build the New bill screen in `apps/desktop/src/renderer/screens/NewBillScreen.tsx`: search box focused on open; 2+ characters shows matches; Enter adds the top match at quantity 1; editable quantity and rate per line; per-line and whole-bill discount as rupees or percent; running totals from core `billing.ts`; optional customer name; payment mode picker (cash, UPI, card, unpaid, label only); remove line; Save with Ctrl or Cmd+S
- [X] T049 [P] [US2] Build the line editor in `apps/desktop/src/renderer/components/BillLineRow.tsx` with decimal rules from core `quantity.ts` and inline error text
- [ ] T050 [P] [US2] Build the Settings screen in `apps/desktop/src/renderer/screens/SettingsScreen.tsx` for the shop profile fields and the bill number template with a live preview and a warning if the number could exceed 16 characters **(Status: code written, builds and typechecks; the Settings screen was not opened in a test)**
- [X] T051 [US2] Autosave the in-progress bill to the draft after every change in `apps/desktop/src/renderer/state/billDraft.ts` and offer recovery on app start; make T041 and T042 pass
- [X] T052 [US2] After a successful save, show the saved bill with "Print", "Save PDF" and "New bill" actions in `apps/desktop/src/renderer/screens/BillView.tsx` (buttons are wired in T055 to T057)

### Printing and PDF for User Story 2 (FR-015; pulled forward from US3 because the MVP bill must print)

- [X] T053 [P] [US2] Unit tests in `apps/desktop/tests/unit/billLayout.test.ts`: the rendered HTML for a bill contains the header, lines, totals and footer from `specs/001-shop-os-mvp/contracts/bill-layout.md`, shows no tax wording, hides zero discounts, and trims quantity decimals
- [X] T054 [P] [US2] Implement the bill renderer in `apps/desktop/src/main/services/billHtml.ts` (path resolves after T093 moves it into its own folder) producing HTML from a bill, lines and shop profile per `contracts/bill-layout.md`, with print stylesheets for `58mm`, `80mm`, A4 and A5, using only snapshot values (`item_name_snapshot`, `unit_snapshot`) and core money formatting; makes T053 pass
- [X] T055 [US2] Implement `PrintService` in `apps/desktop/src/main/services/PrintService.ts`: print through the OS dialog for the chosen target and export PDF with `printToPDF`; a failure returns `PRINT_FAILED` or `WRITE_FAILED` and never touches the saved bill (depends on T054)
- [X] T056 [US2] Add `BillRepository.get` in `apps/desktop/src/main/repositories/BillRepository.ts` and wire `bills.get`, `bills.print` (`target`: receipt, a4, a5) and `bills.exportPdf` in `apps/desktop/src/main/ipc/handlers.ts`
- [ ] T057 [US2] Enable the Print and Save PDF buttons in `apps/desktop/src/renderer/screens/BillView.tsx`; if printing fails show an inline message and keep the bill saved (spec US2 scenario 7) **(Status: code written; the Print button and OS print dialog were never exercised; PDF export is proven through the command in tests/e2e/pdf.spec.ts)**
- [ ] T058 [US2] Verify the 80 mm receipt on the real printer with a 5-line bill and a long item name (settings from spike T008); record the result and the timed 5-line bill (SC-002) in `specs/001-shop-os-mvp/quickstart.md` **(Status: NOT done: needs the real printer)**

**Checkpoint (MVP US2 exit)**: Spec US2 scenarios 1 to 8 pass; a 5-line bill is created, saved and printed in 60 seconds or less (SC-002).

---

## Phase 5: Backup and packaging (MVP release gate)

**Purpose**: FR-021 (automatic backup, a MUST) and FR-020 (offline). Without a backup, a disk failure loses every bill, so this stays in the MVP.

- [X] T059 [P] Integration tests in `apps/desktop/tests/integration/backup.test.ts`: backup produces a file that opens and contains the same items and bills; backup while a bill is being saved is consistent; retention keeps the last 30 daily copies; restore replaces the database with the chosen file; a corrupt file returns `INVALID_BACKUP`
- [X] T060 Implement `BackupService` in `apps/desktop/src/main/services/BackupService.ts` using better-sqlite3 `db.backup()` (verify the exact call in the better-sqlite3 documentation first) to write timestamped copies to the configured second folder on app close and every 15 minutes while the app is open, record each attempt in `backup_log` (`path`, `started_at`, `finished_at`, `status` `ok` or `failed`, `error`), and prune to the last 30 daily copies
- [ ] T061 Wire `backup.run`, `backup.status`, `backup.restore` in `apps/desktop/src/main/ipc/handlers.ts` and add a Backup section (folder chooser, last good backup time, Run now, Restore from file, visible failure message) to `apps/desktop/src/renderer/screens/SettingsScreen.tsx` **(Status: backend and IPC tested; the Backup section of Settings was not opened in a test)**
- [ ] T062 Configure packaging in `apps/desktop/electron-builder.yml` for macOS (unsigned with documented first-run steps if no Apple developer account), and verify the packaged app runs quickstart scenarios 1 to 4 on a clean machine with networking disabled **(Status 2026-11-15: PARTLY done, box stays open. Done: `electron-builder.yml` signs ad hoc (`identity: "-"`; `null` left the bundle half-signed and failing `codesign --verify`), a DMG builds, first-run steps are in `docs/restore-guide.md`, and the packaged app passes the specs for quickstart scenarios 1 to 4 plus PDF, also with the app's network denied by `sandbox-exec` (`pnpm --filter @shopos/desktop test:e2e:packaged --offline`). NOT done: a clean second Mac (the Gatekeeper first-run steps are untried on a downloaded copy), and networking physically disabled; Windows and Linux installers not built.)**
- [ ] T063 Write the owner-facing restore guide in `docs/restore-guide.md`: where the data and backups live, how to restore on a new computer, how to check the last backup; have someone other than the builder follow it once **(Status: docs/restore-guide.md written; not yet followed by a second person)**

**Checkpoint (MVP exit)**: Inventory and billing work in the packaged app offline; a bill prints; a restore from backup succeeds.

---

## Phase 6: User Story 3 - Find, reprint and cancel bills (Priority: P2, in the first release) (M4)

**Goal**: Staff find any past bill, reprint it identically, and cancel a wrong bill with a reason so stock is restored and the number is never reused (spec FR-016, FR-017, FR-018; quickstart scenario 5).

**Independent Test**: Save a bill, find it by number, date range and customer name, reprint it, then cancel it with a reason and confirm stock returns, the bill shows as Cancelled, and its number is not reused.

### Tests for User Story 3 (write first)

- [X] T064 [P] [US3] Integration tests in `apps/desktop/tests/integration/billCancel.test.ts`: cancel requires a non-empty reason (`REASON_REQUIRED`); cancel inserts one `sale_cancel` movement per line equal and opposite to the sale; item stock returns to its pre-sale value; the next saved bill gets the next sequence number (cancelled number never reused); a second cancel returns `ALREADY_CANCELLED`; the database refuses any other update or delete of a saved bill, bill line or movement _(done 2026-11-17: 14 tests in `tests/integration/billCancel.test.ts`, written first and seen failing; also NOT_FOUND, stock that went negative, an item deactivated since the sale, an unchanged bill and tender, a second cancel changing nothing, and an atomicity test that forces a failure on the second `sale_cancel` insert and finds the bill still posted, no movement and the same stock)_
- [X] T065 [P] [US3] Unit tests in `apps/desktop/tests/unit/billLayout.test.ts` (path resolves after T093 moves it into its own folder): a cancelled bill renders a CANCELLED banner with the reason and keeps its number; a normal bill is unchanged _(done 2026-11-17, tests only: `billHtml.ts` has rendered the banner since T054, so no renderer code changed. 13 new tests in `tests/unit/billCancelledLayout.test.ts`, a new file so it cannot clash with the title and round-off edits to `billLayout.test.ts` (T081); move it beside `billHtml` with the others in T093. Checked by breaking the renderer twice: with the banner never shown 5 tests fail, with the reason left unescaped 1 fails. The cancelled page equals the posted page once the banner is removed)_
- [ ] T066 [P] [US3] End-to-end test in `apps/desktop/tests/e2e/bills.spec.ts` following quickstart scenario 5 (find by number, date range and customer name; reprint; cancel; stock restored)

### Implementation for User Story 3

- [X] T067 [P] [US3] Implement `BillRepository.list` (filter by number, date range, customer name, status; newest first; paging with a maximum page size) in `apps/desktop/src/main/repositories/BillRepository.ts` _(done 2026-11-17 as `BillSearchRepository.list` in `repositories/BillSearchRepository.ts`: `BillRepository.ts` is already over the 200-line limit, so the read-only search is its own small class and `BillRepository` only exports `toBill`. Date filters compare the stored `business_date`; page size is capped at `MAX_BILL_PAGE_SIZE` = 500; tests in `tests/integration/billList.test.ts` (13). It stays in `repositories/` and its test in `tests/integration/` until T093 decides whether repositories get folders and widens the test `include`)_
- [X] T068 [US3] Implement `BillingService.cancelBill` in `apps/desktop/src/main/services/BillingService.ts`: one transaction that sets status `cancelled`, `cancel_reason` and `cancelled_at`, appends the reverse `sale_cancel` movements and restores cached item stock; refuse if already cancelled or the reason is empty (depends on T067) _(done 2026-11-17: `BillingService.cancelBill(input, now)`; the one allowed bill update is `BillCancelRepository.markCancelled` (a `where status = 'posted'` update, so a race or a repeat cancels once); the reason is trimmed and stored trimmed; the stock restore uses the bill's own lines, one `sale_cancel` per line)_
- [X] T069 [US3] Add `bills.list` and `bills.cancel` to `packages/core/src/commands.ts` and the preload command list, and wire them in `apps/desktop/src/main/ipc/handlers.ts` with the Zod schemas in `packages/core/src/types.ts` (contract: `specs/001-shop-os-mvp/contracts/ipc-commands.md`) _(done 2026-11-17: both commands are in the command map and name list in contract order, so the preload bridge, which is built from that list, exposes them with no change of its own; `BillingService.listBills` serves the list; the schemas now check `from` and `to` as `YYYY-MM-DD`, the search text lengths (40 and 80) and a cancel reason of at most 200 characters, a limit I chose because the spec has none (contract notes it); handler tests for both commands with every error code; the screens that call them are T070 and T071)_
- [ ] T070 [P] [US3] Build the Bills screen in `apps/desktop/src/renderer/screens/BillsScreen.tsx`: search by number, date range and customer name; status shown as the word "Cancelled" (not colour alone); open a bill in the existing bill view
- [ ] T071 [US3] Add the Cancel bill action with a required-reason dialog in `apps/desktop/src/renderer/components/CancelBillDialog.tsx`, show the CANCELLED banner in `apps/desktop/src/renderer/screens/BillView.tsx` and `apps/desktop/src/main/services/billHtml.ts` (path resolves after T093 moves it into its own folder); saved bills show no edit or delete controls anywhere; make T064 to T066 pass
- [ ] T072 [US3] Verify reprint is identical to the original and cancel restores stock on a real counter run; record the result in `specs/001-shop-os-mvp/quickstart.md` (scenario 5)

**Checkpoint (US3 exit)**: Spec US3 scenarios 1 to 3 pass; a wrong bill can be cancelled and the stock comes back.

---

## Phase 7: Decisions of 2026-11-15 and design compliance (M3b, then M5)

**Purpose**: apply the owner's answers to the spec audit (research D18 to D23) and close the constitution IX and X violations recorded in plan.md Complexity Tracking. Each task is one PR of 400 changed lines or fewer. Run T073 to T081 **before** US3 (T064 to T072) so cancel and the bill list are built on the new tables. **T093 (folder per component and service) runs first** for the files not yet touched by an open PR, so later tasks edit files already in their final folders. Tasks written before T093 name today's flat paths; each such path resolves to its folder after T093 (T093 lists the bill-renderer destinations).

### Folder per component and service (owner request 2026-11-15, do earliest)

- [ ] T093 Move each renderer component, screen and hook, and each main-process service and helper module, into its own folder with its tests, styles, `constants.ts` and `types.ts` beside it (rule in `shopos-react-components` section 1 and `shopos-service-layer` section 2a). One folder or a few folders per PR, 400 changed lines or fewer each, using `git mv`, behaviour unchanged. _(status 2026-11-16: the vitest include is widened (PR for T093 first step); the RENDERER half is moved: every component, screen and hook is in its own folder with an `index.ts` and its test beside it where one exists; `constants.ts` and `types.ts` exist only where a component had some. Still open: the main-process services and helpers (`billHtml/` and the others), co-locating the remaining integration tests, `.module.css` styles; so the box stays open)_ Final destinations referenced by T054, T065, T071 and T081: `apps/desktop/src/main/services/billHtml/billHtml.ts`, with its tests beside it as `billHtml/billLayout.test.ts` and `billHtml/billHtml.edges.test.ts`. First PR: widen the test `include` in `apps/desktop/vitest.config.ts` to also match `src/**/*.test.{ts,tsx}`, and update lint and tsconfig paths if needed. Traces to constitution IX (small, pure, placed) and plan.md Complexity Tracking; no FR covers a refactor. Open items: `.scss` needs the `sass` package (owner approval first; use `.module.css` until then); whether to move repositories the same way; the constitution wording is amended to `constants.ts` and `types.ts` (v2.1.0)

### Schema in the architecture's shape (D18; spec FR-001, FR-003, Key Entities)

Every schema task: edit `apps/desktop/src/main/db/schema.ts`, run `pnpm --filter @shopos/desktop db:generate`, read the SQL, re-create the immutability triggers for any rebuilt table in the same migration, migrate existing rows (never drop them), update `data-model.md` "Current schema", and keep `pnpm test` and `pnpm test:e2e` green.

- [X] T073 Tests first in `apps/desktop/tests/integration/schemaShape.test.ts`: the target tables and columns of `data-model.md` "Target shape" exist; triggers reject update and delete on `stock_movement`, `bill_line`, `bill_tender` and `bill_number_gap`; a bill can only move from `posted` to `cancelled`; rows from a database at migration 0004 survive the upgrade with the same totals and stock _(done 2026-11-15: `schemaShape.test.ts` with `helpers/schemaSteps.ts` (the target columns per task), `schemaRows.ts` (raw rows in the 0004 and target shapes) and `schemaProgress.ts`. The suite is written ahead of the schema, so each group runs only when its flag in `schemaProgress.ts` is true: **flip the flag in the same PR as T074, T075, T076, T077, T078, T080 or T083**. Checked once with every flag on: 23 tests fail for the right reason (missing target tables and columns) and the 0004 "before" rows insert cleanly. Caveat: the target-shape row helper (`insertTargetBill`) has not run against a real target schema yet; expect to adjust a column name when T078 lands, and fix `data-model.md` if the test was wrong)_
- [X] T074 Items: split `item` into `item_family` and `item_variant` (one variant per family; `name` to `display_name`, `price_paise` to `selling_price_paise`, `unit` to `base_uom`, `active` to `is_active`, add `item_code`); update `ItemRepository.ts`, `InventoryService.ts` and their tests (depends on T073) _(done 2026-11-15: migrations `0005_add_item_family_variant` (new tables, rows copied: family and variant keep the old item's id, codes `ITM-0001`...) and `0006_move_item_references` (stock movements and bill lines now reference `item_variant`, triggers re-created, `item` dropped last, `defer_foreign_keys` on). Only `ItemRepository.ts` changed in `src/`; `InventoryService.ts` needed nothing because the repository still returns `Item`. `validateBackupFile` accepts a backup with `item` or `item_variant`. Flag T074 on in `schemaProgress.ts`; `itemSplitUpgrade.test.ts` runs 0005 and 0006 on a 0004 database holding a bill. Why two migrations: drizzle-kit asks an interactive rename question when one diff both creates and drops tables)_
- [X] T075 Locations and movements: add `location` with the seeded "Shop floor" in `apps/desktop/src/main/db/seed.ts`; reshape `stock_movement` to `movement_type`, positive `qty_base_milli`, `from_location_id`/`to_location_id`, `doc_type`/`doc_id`, `variant_id`; update `StockRepository.ts` and `packages/core/src/stock.ts` (direction from the locations) with tests first in `packages/core/tests/stock.test.ts` (depends on T074) _(done 2026-11-15: migration `0007_reshape_stock_movement` (adds `location`, seeds "Shop floor" for an existing shop, translates every movement: negative quantity leaves the shop floor, positive arrives; adjustment note and one-direction checks; triggers re-created); `ensureSeed` creates the location on first run; core `movementLocations` and `signedQuantityMilli` (7 tests written first); `StockRepository` still returns a signed `quantityMilli`, so services and screens are unchanged. `stockMovementUpgrade.test.ts` runs 0007 on a 0004 database. Also: the shared fixture `upgradeFixture.ts` seeds the old database with raw SQL because `ensureSeed` now needs the `location` table)_
- [X] T076 Bill header: rename `number` to `bill_no`, `saved` to `posted`, `lines_total_paise` to `subtotal_paise`, `grand_total_paise` to `total_paise`; add `device_id`, `counter_code`; update the `bill_only_cancel_update` trigger's column list, `BillRepository.ts`, `BillingService.ts`, `packages/core/src/types.ts` and the contract (depends on T073) _(done 2026-11-15: migration `0009_reshape_bill_header` rebuilds `bill` (also `series_code` to `counter_code`, `device_id` from the shop profile, `saved` to `posted`), re-creates `bill_no_delete` and `bill_only_cancel_update` with the new names. Core: `BillStatus` is `posted` or `cancelled` (also the `bills.list` filter, contract updated). The domain `Bill` keeps `number`, `seriesCode`, `linesTotalPaise`, `grandTotalPaise`: `BillRepository` maps them, so `BillingService` and the screens did not change. Also `openDatabase` now turns foreign keys off before the migration transaction and runs `foreign_key_check` after, because `PRAGMA foreign_keys` does nothing inside drizzle's transaction and dropping a referenced table with rows is unsafe otherwise; tested with a database that already has a broken reference)_
- [X] T077 Bill lines and tenders: `bill_line.item_id` to `variant_id`, `quantity_milli` to `qty_base_milli`, `rate_paise` to `unit_price_paise`; move `payment_mode` into a new append-only `bill_tender` row (`mode`, `amount_paise`, `status` `label`) written in the save transaction (depends on T076) _(done 2026-11-15: migration `0010_add_bill_tender` creates `bill_tender` (one tender per existing bill: its old payment mode, the whole total, status `label`), rebuilds `bill_line` with `variant_id`, `qty_base_milli`, `unit_price_paise` and rebuilds `bill` without `payment_mode`; the `bill_line` and `bill` triggers are re-created and `bill_tender` is append-only too. `BillRepository.insertBill` writes the tender in the save transaction and `get` reads the mode from it (a bill with no tender fails loudly); the domain `Bill.paymentMode` and `BillLine` field names are unchanged, so `BillingService` and the screens did not change)_
- [X] T078 Numbering and time columns (FR-019a): replace `number_counter` with `number_series` (adds `template`); change `created_at`, `updated_at`, `occurred_at`, `cancelled_at` to INTEGER epoch milliseconds through `apps/desktop/src/main/db/ids.ts` helpers; `bill_date` becomes `billed_at` (epoch ms) plus `business_date` (depends on T076) _(done 2026-11-15 in two commits. First half: migration `0011_number_series_and_billed_at` replaces `number_counter` with `number_series` (keeps the shop's template) and splits `bill_date` into `billed_at` (UTC epoch ms) and `business_date`, with `number_series_id` on each bill; the bill triggers are re-created. Core `DEFAULT_TIME_ZONE` and `localIsoOf` (tests first); `BillingService` now takes the date and financial year from the shop's zone, not the device's, and `BillRepository` shows the stored instant as the shop's wall-clock time so the domain `Bill.billDate` is unchanged. ASSUMPTION in the migration: old bills' local time was Asia/Kolkata. Billing tests now use explicit UTC instants. Second half: migration `0012_epoch_millisecond_times` rebuilds all eleven tables with `created_at`, `updated_at`, `occurred_at` and `cancelled_at` as INTEGER epoch milliseconds, converted exactly to the millisecond (`strftime('%s')` times 1000 plus the three digits of `strftime('%f')`), triggers re-created; `ids.ts` gets `nowMs` and `isoOfMs`, and the repositories, seed and `BackupService` write integers while the domain keeps ISO text. drizzle-kit wrote the item name index with the whole expression backtick-quoted as a column; fixed by hand in the migration. Flag T078 on in `schemaProgress.ts`: the integer-time, immutability and full 0004-upgrade groups of `schemaShape.test.ts` now run and pass)_

### Round-off, time zone, title (D20, D22, D23; spec FR-010a, FR-015a, FR-019a)

- [X] T079 [P] Tests first, then core: `packages/core/src/businessDate.ts` (business date and financial year from a UTC instant and a named zone; 23:50 IST on 31 March and 00:10 IST on 1 April fall in FY 26-27 and 27-28 with the device in another zone) and `roundBillTotal` in `packages/core/src/money.ts` (₹849.60 to ₹850.00 with +40 paise; ₹849.49 to ₹849.00 with -49; ₹849.50 to ₹850.00; off gives 0), in `packages/core/tests/businessDate.test.ts` and `money.test.ts` _(done 2026-11-15: `businessDateOf(instantMs, timeZone)`, `financialYearOfBusinessDate(businessDate)` and `roundBillTotal(totalPaise, isRoundingOn)`; 21 new tests; the existing `financialYear(date)` in `numbering.ts` still uses the device zone and is replaced by the new function when the bill save uses it, T080)_
- [ ] T080 Shop settings: add `doc_title` (default "Estimate"), `round_bill_total` (default on), `time_zone` (default `Asia/Kolkata`) and `receipt_width` (`58mm`, `80mm` default, `a4`, `a5`) to `shop_profile`, `SettingsRepository.ts`, `SettingsService.ts`, the Zod schemas and `SettingsScreen.tsx`; store `doc_title` and `round_off_paise` on each bill in `BillingService.saveBill`; warn (never block) when the device zone differs from the shop zone or the clock is earlier than the last saved bill (depends on T078, T079)
- [ ] T081 Print: show the stored `doc_title` and the signed round-off line in `apps/desktop/src/main/services/billHtml.ts` (path resolves after T093 moves it into its own folder) per `contracts/bill-layout.md`, with tests in `apps/desktop/tests/unit/billLayout.test.ts` (title "Estimate" by default, no tax wording, round-off hidden when zero) (depends on T080)

### Restore never reuses a bill number (D21; spec FR-013b, EC-19)

- [ ] T082 Tests first in `apps/desktop/tests/integration/restoreNumbering.test.ts`: after restoring a backup taken at seq 120 and confirming "last issued 126", the next bill is 127 and a `bill_number_gap` row 121 to 126 with reason `lost_in_restore` exists; without a confirmed number the series jumps 100 and records the block; a gap never reuses a cancelled number
- [ ] T083 Implement the gap in `apps/desktop/src/main/services/BackupService.ts`, `BillRepository.ts` and `packages/core/src/numbering.ts`; `backup.restore` takes `lastIssuedBillNo?` (contract); make T082 pass (depends on T078)
- [ ] T084 Restore screen asks for the last bill number issued, with the example; the bill list shows recorded gaps as "Lost in restore"; add the step and the retention note (research D19) to `docs/restore-guide.md` (depends on T083, T070)

### Design compliance (constitution X; plan Complexity Tracking)

- [X] T085 [P] Theme preference System, Light or Dark in `apps/desktop/src/renderer/shared/theme/` (resolve System with `matchMedia("(prefers-color-scheme: dark)")` before first paint, pass `appearance` to `<Theme>` in `main.tsx`), a picker in Settings, and component tests _(done 2026-11-15: `shared/theme/` has `ThemeProvider` (reads the saved choice in the first render, `useSyncExternalStore` on the OS theme so it updates live, sets `color-scheme` in a layout effect), `ThemePicker` (a Radix `SegmentedControl` with the words System, Light, Dark), `useThemePreference`, pure `themePreference.ts`; `main.tsx` uses it; stored per device in local storage (design D6, still assumed). 22 renderer tests. Not verified: a real look at light and dark in the running app, and the tiny gap before the JavaScript runs, when the page edge is the browser default (an inline script is blocked by the CSP); Electron's `nativeTheme` for window chrome (optional) is not set)_
- [X] T086 [P] Shared `StatusMessage` and `StatusBadge` in `apps/desktop/src/renderer/shared/components/` (label, sentence, one action; status always has a word), replacing hand-built alerts _(done 2026-11-15: `StatusMessage` (role, label, sentence, one action; alerts for danger and warning, polite status otherwise) and `StatusBadge` in `shared/components/`; every `Callout` and `Badge` in the renderer outside `shared/` now uses them: toast, Settings (backup failed, bad number format), item form (errors, duplicate name), bill view (negative stock, Cancelled), items list and nav badges, recovered-draft note; new words in `uiText.status`. Wording change to know: the negative-stock badges are now the warning role (orange) instead of red, as the design guidelines say; "Error:" and "Done:" lost their colon because the label is its own word. 19 renderer tests, the existing e2e sentences are unchanged but the e2e specs were not run)_
- [ ] T087 Remove the inline `style` uses from `apps/desktop/src/renderer` (33 today) in favour of Radix props and tokens, one screen per PR; check every screen in light and dark against the new-screen checklist in `docs/design/design-guidelines.md` _(code done 2026-11-15, one commit per screen: App shell, items, bill view, bill line row, settings, item form, toast host, new bill. Zero `style=` left in `src/renderer` (was 33). Widths are Radix layout props from `renderer/layout.ts`; what Radix has no prop for (nav border and background, search dropdown, toast position, full-width select, dimmed inactive row) is token-only classes in `renderer/app.css`, no hex colours. `tests/unit/rendererStyleRules.test.ts` now fails on an inline style, a hex, rgb or hsl colour, or a pixel font size in the renderer (checked by planting a violation). The production build bundles `app.css`. NOT done: the check of every screen in light AND dark with real eyes, and the contrast measurement (design D4), because they need the running app; every colour is a Radix token so both themes are expected to work. Tick that part after a look at System, Light and Dark on each screen, then T087 is fully done)_

### Small, pure renderer (constitution IX; with spec 017 T030)

- [X] T088 Move the renderer to `app/`, `features/` and `shared/` per `shopos-react-components`, one folder per PR, tests green before and after _(done 2026-11-16 as seven mechanical PRs following the T093 folder rule: shared (api, text, layout, toast), theme, status components, app, inventory, billing, settings; `screens/`, `components/` and `state/` are gone. Renderer tests (67), typecheck and build pass before and after each move)_
- [X] T089 Split `NewBillScreen.tsx` (472 lines) into `useBillForm`, `useBillSave`, `BillSearchBox`, `BillLinesTable`, `BillSummaryPanel` and `RecoverDraftDialog` (same work as spec 017 T030; do it once) _(done 2026-11-21 as seven stacked PRs: behaviour tests first, then RecoverDraftDialog, BillSummaryPanel, BillLinesTable, BillSearchBox with useItemSearch, useBillForm and useBillSave, each with its own tests; `NewBillScreen.tsx` went from 447 to 136 lines and its component function from about 400 to 109 lines, under the 120-line component limit; the generic 40-line function warning still shows for it, and the focus handling and draft recovery could be hooks later)_
- [ ] T090 Split `ItemForm.tsx` (230 lines) and `SettingsScreen.tsx` (233 lines) under the 120-line component limit

### Operations (research D15; finding H5)

- [X] T091 Before running a pending migration on start-up, take a backup with the online backup API; run `PRAGMA integrity_check` on start and offer restore on failure; tests in `apps/desktop/tests/integration/startupSafety.test.ts`. Must land before any rebuilt-table migration (T074 to T078) reaches the shop's database _(done 2026-11-15: `main/db/startupSafety.ts` and `main/app/startupRecovery.ts`; copies go to `pre-migration-backups/` beside the database, newest 5 kept; a damaged file raises `DATABASE_CORRUPT` and the app offers a backup to restore, then relaunches; 8 safety tests and 5 start-up tests. Disk-space check and the local log file from D15 are not part of this task)_

### Dates (research D25; owner request 2026-11-15)

- [ ] T092 Introduce Luxon in place of hand-written date code (FR-019a, research D22 and D25), as its own task and PR(s), separate from T079 and T080. Add `luxon` and `@types/luxon` (owner approved the package 2026-11-15; confirm `@types/luxon` is needed, open item). Tests first, then replace with behaviour kept the same: `packages/core/src/businessDate.ts` (built on `Intl.DateTimeFormat` in T079), `packages/core/src/numbering.ts` (`financialYear` with `getMonth() >= 3`), `apps/desktop/src/main/services/BillingService.ts` (local date text with `pad`), `BackupService.ts` and `main/db/startupSafety.ts` (backup file-name stamps), `renderer/screens/SettingsScreen.tsx` (`toLocaleString`). The T079 boundary tests (23:50 IST on 31 March against 00:10 IST on 1 April, device in another zone) must pass unchanged. Open item: add Luxon to the stack line in CLAUDE.md after the owner says yes

**Checkpoint (M3b exit)**: T073 to T084 and T091 done; every existing test green on the new tables; the boundary and round-off tests pass. **Checkpoint (M5 design)**: T085 to T090 done; every screen checked in light and dark.

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
4. Phase 7 (T073 to T091): the schema move and safety first (T091, T073 to T078), then T079 to T084, then US3 on the new tables, then design compliance (T085 to T090).
5. Still deferred: spreadsheet import (FR-007, feature 012); accessibility and shortcut polish; the formal 2-week trial with SC-001, SC-004 to SC-007 checks (M6).
6. Do not start tax, khata or other PRD modules before that.

## Format validation

Every task starts with `- [ ]` or `- [X]`, has a sequential ID (T001 to T092), carries a story label only inside story phases, and names exact file paths.
