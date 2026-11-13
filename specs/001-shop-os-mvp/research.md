# Research: Shop OS MVP (Inventory + Basic Bill)

All decisions come from the architecture doc, narrowed to the desktop-only MVP. Library versions and the two spike items are confirmed in milestone M0. No web research was done for this document.

## Decisions

### D1. Local-first desktop app, no server
- **Decision**: Electron app with a local SQLite database; no server, sync or accounts.
- **Rationale**: Meets "works offline" by construction and costs nothing to run; it is the smallest slice of architecture option B.
- **Alternatives**: Web app with a server (rejected: depends on internet); Flutter desktop (rejected: rules would need a second implementation for a later TypeScript server).

### D2. TypeScript throughout with a shared `shopos_core` package
- **Decision**: pnpm workspace; `packages/core` has pure functions only.
- **Rationale**: One implementation of money, quantity and billing rules; testable without UI or database; reusable by a later server and React Native phone apps.
- **Alternatives**: Put logic in the renderer (rejected: cannot be reused or tested cheaply).

### D3. SQLite via better-sqlite3 with Drizzle ORM
- **Decision**: Synchronous better-sqlite3 in the Electron main process, Drizzle for schema and migrations, WAL mode, foreign keys on.
- **Rationale**: Fast, simple, transactional (a bill and its stock movements save in one transaction); Drizzle gives typed queries and generated SQL migrations.
- **Alternatives**: Kysely (equally valid, fewer migration tools); Prisma (heavier engine, awkward in Electron).
- **Open item (M0)**: Confirm the driver builds and runs in the packaged app on Mac and Windows.
- **Status (implementation)**: better-sqlite3 12.x built and ran under Node 25 on macOS arm64 (all integration tests use it). Not yet verified inside a packaged Electron app: `electron-builder.yml` sets `asarUnpack` for it and `npmRebuild: true`; the packaged-app check (task T007/T062) is still open.
- **Note**: drizzle-orm resolved to 0.36.4, which needs the object form of table extras; the array form is not supported in this version.

### D4. Encryption-ready, not encrypted, in MVP
- **Decision**: Keep a single place that opens the database where an encryption key can be supplied; ship unencrypted unless the M0 spike shows SQLCipher builds cleanly.
- **Rationale**: The MVP has no customer personal data beyond optional name and phone; avoid build risk for a solo builder.
- **Alternatives**: SQLCipher from day one (deferred); OS full-disk encryption advised in the restore guide.
- **Status (implementation)**: Deferred. The key hook is the commented `encryptionKey` line in `apps/desktop/src/main/db/connection.ts`. No SQLCipher build was tried (spike T009 not run); the restore guide advises disk encryption.

### D5. Money and quantity as integers
- **Decision**: Money in paise (integer); quantity in thousandths of a unit (integer); display with Indian number grouping. Percent discounts round to the nearest paisa, half up, per line.
- **Rationale**: Removes floating point drift; guarantees totals match manual calculation (SC-007).
- **Alternatives**: Decimal library (more dependencies, no benefit at this scale).

### D6. Stock derived from immutable movements
- **Decision**: A `stock_movement` table is append-only; current stock is the sum of movements per item, with a cached column on the item updated in the same transaction and verifiable against the sum.
- **Rationale**: Every number traceable (NFR-015 spirit); cancellation is a reverse movement, not an edit; sync-friendly later.
- **Alternatives**: A stored quantity edited in place (rejected: untraceable and not sync-safe).

### D7. UUIDs and shop ids from day one
- **Decision**: UUID v7 primary keys (time-ordered), and `business_id` plus `shop_id` columns on every table, set to the single local business and shop.
- **Rationale**: Adding sync or multi-shop later needs no data migration (PRD decision of 12 Nov 2026).
- **Alternatives**: Auto-increment ids (rejected: collide across devices).

### D8. Bill numbering
- **Decision**: A counter row per series (`counter_code` plus financial year) incremented inside the save transaction; the number is formatted from a template such as `C1/26-27/000123`; numbers are never reused, including for cancelled bills.
- **Rationale**: Unique and gap-free in normal use; per-counter series already prevents clashes when more devices are added.
- **Alternatives**: Random ids (rejected: shop expects sequential numbers).

### D9. Bill output
- **Decision**: Render the bill as HTML with two print stylesheets (80 mm receipt and A4/A5); print via the OS dialog and export PDF via Electron `printToPDF`. Raw ESC/POS is deferred.
- **Rationale**: Works with any printer with a driver; one layout to maintain; print failure never blocks save because the bill is committed first.
- **Alternatives**: node ESC/POS libraries (deferred: USB access and driver quirks add risk; revisit after the M0 printer test).
- **Status (implementation)**: Bill HTML (`billHtml.ts`), `PrintService` (OS dialog and `printToPDF`) are built and unit-tested with a fake renderer. NOT yet verified on a real printer or in a real PDF viewer: printer model and paper width are still unknown (spike T008, task T058 open). The 80 mm layout uses `@page { size: 80mm auto }`; whether the driver honours it is unverified.

### D10. Backup
- **Decision**: Use SQLite's online backup to write a timestamped copy to a user-chosen second folder or drive on app close and every 15 minutes while open; keep the last 30 daily copies; a restore screen and a written guide.
- **Rationale**: Satisfies FR-021; consistent snapshots without stopping the app.
- **Alternatives**: Cloud backup (deferred; needs the server and credentials).

### D11. Import
- **Decision**: exceljs reads xlsx/csv; a preview step lists valid rows, errors and duplicates; nothing is written until the user confirms, then all rows insert in one transaction as opening-stock movements.
- **Rationale**: Dirty data is the top risk; all-or-nothing import avoids half-loaded inventory.

### D12. Testing
- **Decision**: Vitest for core and services against in-memory SQLite; Playwright for Electron for the quickstart scenarios.
- **Rationale**: Core money and stock logic gets exhaustive unit tests; end-to-end tests prove the acceptance scenarios.

### D13. UI components: Radix UI
- **Decision**: Use Radix UI in the renderer. `@radix-ui/themes` provides styled, accessible components (tables, dialogs, selects, toasts, tabs); `radix-ui` primitives are used directly where a custom look or keyboard behaviour is needed (for example the bill-line editor).
- **Rationale**: Chosen by the owner. Radix components handle focus management, keyboard navigation and ARIA roles, which supports the keyboard-first counter and the accessibility requirement (NFR-011).
- **Alternatives**: Radix primitives only with hand-written CSS (more design work for a solo builder); other component libraries (not chosen).
- **Note**: Whether to use Themes or primitives only was not specified by the owner; Themes plus primitives is the plan's default and is easy to change.

### D14. Readable names (constitution principle VIII)
- **Decision**: No single-letter identifiers anywhere. ESLint `id-length` (minimum 2, properties included) is an error in `eslint.config.js`. Names say what a value holds (`billDiscountPaise`) or what a function does (`calculateLineAmount`); booleans read as questions; units appear in names.
- **Status**: All 339 existing violations were renamed on 2026-11-13 with a scope-aware tool; lint, typecheck and all 96 tests pass afterwards.
- **Limit**: Lint can enforce length but not meaning; readability of longer names stays a review check. SQL string aliases are not linted and were renamed by hand.

### D15. Operations: upgrades, corruption, disk, logging (open design, review M5)
- **Proposed**: take an automatic backup copy before running a pending migration on start-up; run SQLite's integrity check on start and offer restore-from-backup on failure; check free disk space before a bill save and warn below a threshold; write a local log file with no customer data; no crash reporting leaves the machine.
- **Status**: proposed, not built. To be turned into tasks once confirmed.

### D16. Access control in this release (accepted risk, review M14)
- **Decision**: Feature 001 has no login or PIN; anyone at the counter can cancel bills, adjust stock and change settings. This is accepted until feature 005 adds roles and approvals.
- **Mitigations**: operating-system login on the counter computer, owner supervision, every cancel and adjustment recorded (cancel reason, adjustment note, immutable movements).

## Unresolved items (non-blocking, tracked as milestone work)

- Business time zone (Asia/Kolkata) and the 31 March / 1 April boundary test (review M3).
- Idempotent `bills.save` so a retry cannot create a second bill (review B2).
- How customer data is kept so privacy-law erasure is possible despite immutable bills (review B6).

- SQLCipher availability in packaged Electron builds (M0).
- Thermal printer model and paper width (M-1).
- Bill number format and whether the financial-year segment is wanted (M-1, owner decision).
