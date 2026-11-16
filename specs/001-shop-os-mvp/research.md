# Research: Shop OS MVP (Inventory + Basic Bill)

All decisions come from the architecture doc, narrowed to the desktop-only MVP. Library versions and the two spike items are confirmed in milestone M0. No web research was done for this document.

## Decisions

### D1. Local-first desktop app, no server
- **Decision**: Electron app with a local SQLite database; no server, sync or accounts.
- **Rationale**: Meets "works offline" by construction and costs nothing to run; it is the smallest slice of architecture option B.
- **Alternatives**: Web app with a server (rejected: depends on internet); Flutter desktop (rejected: rules would need a second implementation for a later TypeScript server).

### D2. TypeScript throughout with a shared core package (`@shopos/core`, the architecture's `shopos_core`)
- **Decision**: pnpm workspace; `packages/core` has pure functions only.
- **Rationale**: One implementation of money, quantity and billing rules; testable without UI or database; reusable by a later server and React Native phone apps.
- **Alternatives**: Put logic in the renderer (rejected: cannot be reused or tested cheaply).

### D3. SQLite via better-sqlite3 with Drizzle ORM
- **Decision**: Synchronous better-sqlite3 in the Electron main process, Drizzle for schema and migrations, WAL mode, foreign keys on.
- **Rationale**: Fast, simple, transactional (a bill and its stock movements save in one transaction); Drizzle gives typed queries and generated SQL migrations.
- **Alternatives**: Kysely (equally valid, fewer migration tools); Prisma (heavier engine, awkward in Electron).
- **Open item (M0)**: Confirm the driver builds and runs in the packaged app on Mac and Windows.
- **Status (implementation)**: better-sqlite3 ^13.1.1, Electron build (Electron ^43.8.10, ABI 148); the app, the integration tests (inside Electron's Node) and Playwright all use it.
- **Packaged-app result (2026-11-15, tasks T006, T007, T062; macOS 26 on Apple Silicon, arm64 only)**:
  - Steps that worked: `pnpm install --frozen-lockfile`, then `pnpm --filter @shopos/desktop package` (electron-vite build, then electron-builder 26.15.7: its `@electron/rebuild` step reported `finished moduleName=better-sqlite3 arch=arm64`, then it packaged Electron 43.8.10, signed ad hoc and built `release/Shop OS-0.1.0-arm64.dmg`, 132 MB; the app is 338 MB). Needs network the first time (Electron zip and the dmgbuild bundle are downloaded).
  - better-sqlite3 13 ships its binaries inside the package (`gypfile: false`, `prebuilds/<platform>.node`). `asarUnpack` puts them in `Shop OS.app/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/prebuilds/`; `darwin-arm64.node` is a Mach-O arm64 bundle. All eight platform binaries (about 17 MB) are shipped; trimming the ones for other platforms is possible but each installer must keep its own.
  - Migrations are found: `extraResources` copies `drizzle/` to `Contents/Resources/drizzle`, which `readAppConfig` uses when `app.isPackaged`.
  - Proven by running the packaged binary (not `out/main/index.js`): `pnpm --filter @shopos/desktop test:e2e:packaged` passes 4 of 4 (inventory, billing, PDF, and `packaged.spec.ts`, which asserts `app.isPackaged`, that `__drizzle_migrations` holds one row per journal entry, that a row added through the screen is on disk, and `integrity_check` is `ok`). With `--offline` (macOS `sandbox-exec` denying all non-loopback network; checked with `curl`: HTTP 200 without it, no connection with it) the same 4 pass.
  - Signing finding: with `mac.identity: null` the bundle is only linker-signed and `codesign --verify --deep --strict` fails ("code has no resources but signature indicates they must be present"), which can show as "damaged" on a downloaded copy. `identity: "-"` (ad hoc) gives a valid signature (`flags=adhoc,runtime`, identifier `in.shopos.desktop`) and the app, including loading better-sqlite3 under the hardened runtime, still runs. electron-builder warns that ad-hoc plus hardened runtime may need the `com.apple.security.cs.disable-library-validation` entitlement; it was not needed on this Mac, but not confirmed on another.
  - NOT verified: a second, clean Mac (Gatekeeper: `spctl --assess` says "rejected", as expected for an app that is not notarised; the first-run steps in `docs/restore-guide.md` are not yet tried from a downloaded, quarantined copy); Mac Intel; Windows (`nsis`) and Linux packaging; physically disabled networking (the sandbox test blocks the app's own network calls, not the machine's).
- **Note**: drizzle-orm is ^0.45.4 (drizzle-kit ^0.31): table extras use the array form `(tableColumns) => [index(...), check(...)]`. Upgrade details: `specs/017-ci-github-workflow/research.md` F7.

### D4. Encryption-ready, not encrypted, in MVP
- **Decision**: Keep a single place that opens the database where an encryption key can be supplied; ship unencrypted unless the M0 spike shows SQLCipher builds cleanly.
- **Rationale**: The MVP holds no customer personal data beyond an optional name (phone was removed 2026-11-13, review B4); avoid build risk for a solo builder.
- **Alternatives**: SQLCipher from day one (deferred); OS full-disk encryption advised in the restore guide.
- **Status (implementation)**: Deferred. The key hook is the commented `encryptionKey` line in `apps/desktop/src/main/db/connection.ts`. No SQLCipher build was tried (spike T009 not run, 2026-11-15): so how to get SQLCipher is unverified. Open items: (1) whether better-sqlite3 can be built against an encryption-enabled SQLite (its docs describe custom SQLite builds) or whether a different package is needed; (2) whether any such build works with Electron 43; (3) the key and recovery design. A package change needs the owner's approval first (CLAUDE.md). T009 stays deferred. The restore guide advises disk encryption.

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

### D11. Import (deferred to feature 012 on 2026-11-15; kept as the design for later)
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
- **Status (2026-11-15)**: backup-before-migrate and the start-up integrity check with a restore offer are built (task T091). The free-disk-space check and the local log file are still proposed, not built.

### D16. Access control in this release (accepted risk, review M14)
- **Decision**: Feature 001 has no login or PIN; anyone at the counter can cancel bills, adjust stock and change settings. This is accepted until feature 005 adds roles and approvals.
- **Mitigations**: operating-system login on the counter computer, owner supervision, every cancel and adjustment recorded (cancel reason, adjustment note, immutable movements).

### D17. Search performance and bill timing budgets (reconciling PRD NFR-001 / SC-002 / SC-003)
- **Decision**: The MVP desktop app benchmarks against 5,000 items with a 0.5 s search budget (SC-003) using SQLite indexing, and targets 60 s for 5-line bill creation (SC-002) during initial staff training and trial.
- **Phased Target**: The full PRD targets (0.2 s search over 50,000 items per NFR-001, and 45 s bill creation per PRD Section 15) apply as the shop scales and are validated in Feature 016 with the in-memory search index.
- **Status**: SQLite indexed search in `searchPerf.test.ts` executes over 5,000 generated items in 3–5 ms, well under the 500 ms ceiling.

## Decisions of 2026-11-15 (owner answers to the spec audit)

The audit report is in the 2026-11-15 conversation; its finding IDs (C1, C2, H2, ...) are quoted below. Web research was done for D19 to D22. Every source was secondary (commentary sites and software vendors, not the statute), so each legal point is a **default to confirm with the CA or counsel**, not settled law.

### D18. Schema in the architecture's shape now (finding H2)
- **Decision**: Move the local schema to the names and shape of `docs/reference/architecture.md` section 8 now, rather than at sync time. Target tables in this release: `item_family` and `item_variant` (one variant per family for now), `location` (one row, "Shop floor") and `stock_movement` with `movement_type`, a positive `qty_base_milli` and `from_location_id`/`to_location_id`; `bill` with `bill_no`, status `posted` or `cancelled`, `business_date` and `billed_at`, `round_off_paise`, `doc_title`; `bill_line` with `variant_id`, `qty_base_milli` and `unit_price_paise`; `bill_tender` holding the payment label; `number_series` replacing `number_counter`; timestamps as INTEGER epoch milliseconds (architecture 8.1, SQLite mapping).
- **Rationale**: The architecture says devices use the same table and column names as the server; doing it while the data is small avoids a migration of real shop data later.
- **Not in this release**: the catalogue engine, tiers, batches, tax columns, parties, users and devices tables. They arrive with features 002, 003, 004, 005 and 010 as new tables and columns.
- **How**: a sequence of PRs of 400 changed lines or fewer (tasks T073 to T081); immutability triggers re-created and tested in each migration; the existing development data is migrated, not dropped.
- **Alternatives**: keep the 001 names and migrate at sync time (rejected by the owner: a later data move on real bills); rename only the same-shape columns (rejected by the owner).

### D19. Customer data erasure and immutable bills (finding C2)
- **Decision**: A saved bill is never changed to honour an erasure request. It keeps exactly what was printed on it for the GST retention period (72 months from the annual return due date, CGST Rule 56; to confirm). An erasure request removes everything else held about the person: from feature 004 the party record (phone, address, marketing consent), which bills reference by id, is blanked; the bill itself stays.
- **This release**: the only personal data is the optional free-text customer name on the bill. It is retained with the bill under the legal-retention exception and listed in the retention note in `docs/restore-guide.md`. No phone or contact details are stored.
- **Basis**: DPDP Act sections 8(7) and 12(3) allow keeping data that another law requires to be kept. Open item for counsel: whether a walk-in (B2C) customer's name must be on the bill at all; if not, the name field may be dropped later.
- **Alternatives**: pseudonymise the name on the bill (rejected: it would alter a saved bill, constitution I).

### D20. Prices, tax and rounding (owner question 5)
- **Decision**: Prices entered are tax-inclusive final prices: a composition dealer cannot collect tax from the customer and MRP includes all taxes. Lines are calculated in exact paise (data-model "Rounding"). A shop setting "Round bill total", on by default, rounds the grand total to the nearest rupee (50 paise and above up) and stores and prints the difference as `round_off_paise`, as the architecture's bill does.
- **Basis**: CGST Act section 170 rounds tax and other sums payable to the rupee; sources disagree on whether it applies per invoice, so rounding the bill total is shop practice, not a legal duty. The e-invoice schema also keeps round-off as a separate amount. To confirm with the CA.
- **Deferred**: spreading a bill discount across lines (architecture 11.1 step 4) only matters once tax is calculated per line; feature 008.

### D21. Bill numbers after a restore (owner question 7, finding H9, PRD EC-19)
- **Decision**: Restoring a backup never lets the counter issue a number that was already issued. On restore the owner is asked for the last bill number issued (from the last printout or the paper book); numbering continues after it, and each skipped number is recorded in the series with reason `lost_in_restore` so the gap is explained in the bill list and in later GST reports. If the owner cannot say, the series jumps ahead by a fixed block of 100 and the block is recorded the same way.
- **Basis**: GST numbering must be consecutive and unique per financial year (Rule 46(b)); practitioner advice is to account for missing numbers as cancelled rather than leave an unexplained gap. To confirm with the CA.
- **Example**: backup at `C1/26-27/000120`, bills 121 to 126 printed, disk fails; owner enters 126; next bill is 127; 121 to 126 are listed as "lost in restore".
- **Later**: feature 010 replaces the manual step with the server handshake (architecture 5.4).

### D22. Business time zone (owner question 8, review M3)
- **Decision**: The shop profile holds a named time zone, default `Asia/Kolkata`. Each bill stores `billed_at` (UTC epoch ms) and `business_date` (the date in the shop's zone, worked out once when saved and never recomputed). The financial year (1 April to 31 March), same-day rules and the bill list use `business_date`. If the device's zone differs from the shop's, or its clock is earlier than the last saved bill, the app shows a warning and keeps billing (constitution IV); it never refuses to bill.
- **Basis**: POS practice is to store UTC and assign business days by the store's configured zone, not the device's. IST has no daylight saving, but a named zone is kept for other shops later.
- **Test**: bills at 23:50 IST on 31 March and 00:10 IST on 1 April fall in different financial years with the device set to another zone.

### D23. Printed document title (owner question 3, finding H6)
- **Decision**: The printed and PDF heading comes from a shop setting `doc_title`, default "Estimate", stored on each bill when saved so a reprint is identical. No tax wording is printed. During the trial the paper bill book stays the legal bill. A composition dealer's legal document is a Bill of Supply with the declaration "composition taxable person, not eligible to collect tax on supplies"; that format arrives in feature 008.

### D24. Receipt printer (owner question 10)
- **Decision**: The shop uses an 80 mm thermal receipt printer. 80 mm is the default; receipt width stays a setting (58 mm, 80 mm, A4, A5). The exact model, driver behaviour with `@page { size: 80mm auto }`, and print timing are still unverified (tasks T008, T058).

### D25. Luxon for date handling (owner request 2026-11-15)
- **Decision**: Use Luxon instead of hand-written date code (`pad(getMonth() + 1)`, `getMonth() >= 3` and similar) and instead of raw `Intl.DateTimeFormat` plumbing. It is its own task (T092), separate from T079 and T080. Behaviour does not change in T092.
- **Why**: the manual code uses the device's zone, which D22 forbids; a named zone and date maths are what Luxon is for, and hand-rolled padding is easy to get wrong.
- **Trade-off**: a new package (size not measured; `@types/luxon` probably needed, unverified). Rejected: keeping built-in `Intl` (no package, but parsing and arithmetic stay hand-written); JS `Temporal` (Electron 43 support not verified); date-fns with its time-zone add-on (two packages for the same job).
- **Industry practice**: the Moment.js project status page recommends Luxon among its successors (recalled, not re-read this session; vendor page). No named-company source found.
- **References**: [Luxon docs](https://moment.github.io/luxon/), [Intl.DateTimeFormat (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat).
- **Open**: add Luxon to the stack line in CLAUDE.md only after the owner says yes (CLAUDE.md rule 6).

### Same-day bill edit (owner question 1, finding C1)
- **Decision**: Allowed, as a new logged version that keeps the bill number (constitution v2.0.0, principle I). Built in feature 003 with feature 005 (roles, audit log). Not in this release: 001 keeps cancel-and-rebill.

### Spreadsheet import (owner question 6, finding H3)
- **Decision**: Out of this release; moves to feature 012 (D11 is kept as the design for later). The `import.*` commands are removed from the 001 contract.

## Unresolved items (non-blocking, tracked as milestone work)

- SQLCipher availability in packaged Electron builds (M0; T009).
- Thermal printer model and driver behaviour at 80 mm (T008, T058).
- CA confirmation of D19 (retention), D20 (rounding), D21 (gap handling) and D23 (title) before the printout is used as a legal bill (before feature 008).
- Counsel: must a walk-in customer's name be kept on the bill (D19).
