---
name: shopos-testing
description: "Use when writing, running or reviewing tests in Shop OS: Vitest unit and integration tests, Playwright end-to-end tests, test-first for money, billing and stock, golden and edge cases, test data builders and readable test names. Includes the commands and the better-sqlite3 Node binary pitfall."
---

# Testing in Shop OS

Authority: constitution VI. Architecture: `docs/reference/architecture.md` 11.11 (testing the logic).

## 1. Levels

| Level | What | Where | Tool |
|---|---|---|---|
| Unit | Pure rules (money, quantity, billing, stock, numbering) | `packages/core/tests` | Vitest |
| Golden | Fixed bills and totals checked by hand; the money path must never change silently | `packages/core/tests` | Vitest |
| Integration | Service + repositories + real SQLite (in memory, all migrations applied) | `apps/desktop/tests/integration` | Vitest, `createTestDb` |
| Contract | Same suite against every repository adapter (when a second adapter exists) | beside the repositories | Vitest |
| Component and layout | Bill HTML, pure components | `apps/desktop/tests/unit` | Vitest |
| End to end | Real window, the quickstart scenarios | `apps/desktop/tests/e2e` | Playwright for Electron (run `pnpm build` first) |
| Drills | Backup and restore, offline run, packaged app | `quickstart.md` | By hand until scripted |

**Where tests live.** A test for one component or one service sits **in that component's or service's folder** (`BillLineRow/BillLineRow.test.tsx`, `BillingService/BillingService.test.ts`). Only tests that span several parts stay in `apps/desktop/tests/` (IPC, end to end, shared helpers). The table above shows the level, not the folder, for single-component tests. Until task T093 moves them, existing tests stay under `tests/`.

Commands: `pnpm test` (all unit and integration), `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`. Run a single desktop file inside Electron's Node with `pnpm --filter @shopos/desktop exec node scripts/vitest-electron.mjs run tests/integration/billing.test.ts` (plain `vitest` uses plain Node and fails on the SQLite binary, see section 6). Coverage: `pnpm test:coverage`.

## 3. Test-first rule

For `@shopos/core` and any code that writes bills, stock or ledger entries: write the failing test first, watch it fail for the right reason, make it pass with the smallest change, then refactor. Other code gets tests before its task is marked done. Never weaken a test to make it pass.

## 4. Writing a good test

- **Name** says the behaviour and the case: `"cancelling restores stock and keeps the bill number"`, not `"test cancel"`.
- **Arrange, act, assert**, in that order, with a blank line between. One behaviour per test.
- **Readable data**: build it with small named helpers (`createItem({ name: "Pipe", stockMilli: 10_000 })`, `buildBillInput([...])`), not long literals repeated in every test. Names follow the naming rules (no `a`, `b`, `r`; use `firstItem`, `saveResult`).
- **Deterministic**: pass the clock and ids in; no real time, randomness, network or shared state between tests; each test gets a fresh `createTestDb()`.
- **No logic in tests**: no loops and conditionals that decide what to assert.
- **Assert outcomes, not internals**: stock, bill number, error code, database rows; not which private method ran.
- **Atomicity**: for every multi-step write, a test that forces a failure midway and proves nothing was left behind.
- **Edge cases**: zero, one paisa, rounding half, maximum, negative, empty, duplicate, wrong unit, inactive item.
- **Idempotency**: repeating a write with the same key changes nothing.

## 5. The test database

`createTestDb()` (`apps/desktop/tests/helpers/testDb.ts`) opens in-memory SQLite and applies every migration, so migrations and triggers are tested by every integration test. Test the triggers directly too ("saved bills and lines cannot be edited or deleted").

## 6. Pitfall: the better-sqlite3 binary

better-sqlite3 has ONE native binary and it must be the Electron build. `pnpm test` in `apps/desktop` runs Vitest inside Electron's Node (`apps/desktop/scripts/vitest-electron.mjs`), so tests, the app and Playwright share it. `apps/desktop/scripts/ensure-electron-sqlite.mjs` fixes a wrong binary automatically (needs network once). If you see a `NODE_MODULE_VERSION` mismatch, you probably ran `npx vitest` directly or `pnpm rebuild better-sqlite3`: use `pnpm test`, or run `pnpm --filter @shopos/desktop ensure:sqlite`. `packages/core` tests need no database and run in plain Node. This is an environment issue, not a code bug.

## 7. Coverage expectations

Every requirement ID in a task has at least one test that names it or its scenario. Success criteria (for example "20 bills match manual totals") have a test, not just a manual check. Property-based tests are valuable here (totals add up, stock equals the sum of movements) but no property-test library is installed; ask before adding one.

## 7b. Coverage gate (spec 017)

CI requires at least 90% coverage (lines, statements, functions, branches) on `packages/core` and the whole of `apps/desktop` (main process, preload and renderer); the gate was switched on at 90% (spec 017 T036), never lowered. Write tests with that in mind: every new function and every branch (error path, empty state, edge value) gets a test; do not add untested code and plan to "cover it later". The coverage tool is installed (`@vitest/coverage-v8`); thresholds and exclusions live only in `config/coverage.ts`, and `COVERAGE_ENFORCE` is true (spec 017 T036). Check locally with `pnpm test:coverage`.

## 8. Checklist

- [ ] Failing test written first (core and money paths)
- [ ] Names describe behaviour; data built with helpers; no single-letter names
- [ ] Deterministic; fresh database per test; no shared state
- [ ] Failure paths, atomicity and idempotency covered
- [ ] `pnpm lint && pnpm typecheck && pnpm test` all pass
