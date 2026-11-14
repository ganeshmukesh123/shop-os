---
name: shopos-database-drizzle
description: "Use when changing the SQLite schema, writing a Drizzle migration, a repository query, a transaction, a trigger or the backup code in Shop OS (apps/desktop/src/main/db and repositories). Covers table conventions, immutability triggers, migration pitfalls, transactions, indexes, backups and the better-sqlite3 Node vs Electron binary."
---

# Database: SQLite with Drizzle

Authority: constitution I, II, III, IV. Architecture: `docs/reference/architecture.md` sections 7, 8 and 12.2. Data model: `specs/<feature>/data-model.md` (update it with every schema change).

## 1. Table conventions

- Every table: `id` (UUID v7 text primary key), `business_id`, `shop_id`, `created_at`, `updated_at` (ISO-8601 UTC text). Multi-shop and sync need these from day one.
- Money columns end in `_paise` (integer), quantities in `_milli` (integer). No REAL or floating columns for either.
- Constraints live in the schema (`check(...)`, unique indexes, foreign keys), not only in code: the database is the last line of defence.
- Names: tables `snake_case` singular (`bill_line`); columns `snake_case`; Drizzle properties `camelCase`.
- Add an index for each way the app looks rows up (number, date, customer name, foreign keys). Remove none without a reason.
- Constants for enum-like text (`'saved' | 'cancelled'`) are checked with a `check` constraint and typed in `@shopos/core`.

## 2. Immutable records (constitution I and II)

- `stock_movement`, `bill_line`: no update, no delete (triggers `RAISE(ABORT)`).
- `bill`: no delete; update only for `saved` to `cancelled` with every other column unchanged (`bill_only_cancel_update`). **Any new column on `bill` must be added to that trigger's "unchanged" list in the same migration.**
- Corrections are new rows (reverse movement, cancel), never edits.

## 3. Migrations

Workflow: edit `schema.ts`, then `pnpm --filter @shopos/desktop db:generate`, then **read the generated SQL**, then run the tests (they apply every migration to an in-memory database through `createTestDb`).

Pitfalls learned here:
- **SQLite rebuilds a table** to drop a column that has a CHECK constraint (drizzle-kit emits create-copy-drop-rename). `DROP TABLE` **silently drops that table's triggers**. Re-create every trigger after such a migration (see `0002`).
- A trigger that names a dropped column blocks the drop: drop the trigger first, recreate it after.
- Hand-written SQL in a migration file is allowed (triggers) but keep it small, commented with the reason, and covered by a test.
- Never edit an applied migration. Add a new one.
- Before running a pending migration on a real database, take a backup copy (design: research D15; not yet built).
- drizzle-orm here is 0.45 (drizzle-kit 0.31): table extras use the array form `(tableColumns) => [index(...), check(...)]`. The old object form `({ name: index(...) })` still compiles but has been deprecated since 0.36; do not use it. Do not use `sql.identifier()` or `sql.as()` with untrusted values.

## 4. Repositories and queries

- SQL and Drizzle calls live **only** in `repositories/`. Services and handlers never import `drizzle-orm` or the schema.
- A repository takes a database handle (or transaction) and the shop context; it always sets `business_id`, `shop_id`, `id` and timestamps.
- One method, one purpose. Return domain types (`Bill`, `Item`), not raw rows.
- Parameterised queries only; escape `%` and `_` in `LIKE` searches (`escapeLike`).
- Use `.returning()` for inserts that need the new row; avoid read-after-write races.
- Page every list (`limit`, `offset`, a maximum page size).

## 5. Transactions and idempotency

- **One use case, one transaction**: bill + lines + movements + stock cache + counter either all commit or none do. better-sqlite3 is synchronous, so a transaction callback must not be `async`.
- Writes that a user can repeat (double-click, retry, crash-and-retry) carry an idempotency key with a unique index (`client_bill_id`); a repeat returns the first result and changes nothing.
- Cached totals (item stock) are updated in the same transaction as the movement and verified against the sum in tests.

## 6. Time

Audit-style timestamps are UTC ISO-8601. `bill_date` is the local business time (open: fix to Asia/Kolkata); financial year (1 April to 31 March) is computed from it in `@shopos/core`, never in SQL.

## 7. Backup and the native module

- Back up with SQLite's online backup API (`db.backup()`), never by copying the live file. Prove a backup with a real restore.
- better-sqlite3 is a native module with ONE binary per install, and it must be the **Electron** build: the app, the integration tests (run inside Electron's Node by `pnpm test`) and Playwright all use it. Never run `pnpm rebuild better-sqlite3` (that builds for plain Node). `scripts/ensure-electron-sqlite.mjs` repairs a wrong binary; electron-builder rebuilds it when packaging.

## 8. Checklist

- [ ] Schema, migration, data-model doc and tests all changed together
- [ ] Generated SQL read; triggers re-created if a table was rebuilt; `bill` trigger updated for new columns
- [ ] No SQL outside repositories; one transaction per use case
- [ ] Money and quantity are integers; new lookups have indexes
- [ ] Repeatable writes are idempotent
