---
name: shopos-screen-integration-tests
description: "Use when writing or reviewing a Shop OS test that drives a React screen against the real IPC handlers, services and SQLite (screen-to-database integration test), when a renderer test with a fake window.shopos would pass on a broken command contract, or when checking that a bill, stock movement, tender or draft row is written correctly from what the cashier types. Covers installRealShopos, freezing only Date, row assertions, forcing a failure mid-transaction and lost-reply retries."
---

# Screen-to-database integration tests

Authority: constitution VI (tests for anything that writes bills, stock or ledger). Base rules: `shopos-testing`.

## 1. What they cover, and why

A renderer test answers every command with a fake, so it passes even when the screen sends input the real Zod check rejects. An integration test under `tests/integration` calls handlers directly and never runs a screen. A screen-to-database test covers the hop between them:

```
render <App/> in jsdom ─ userEvent ─> api.call ─> bridge
   ─> installRealShopos ─> handlers (real Zod) ─> services ─> :memory: SQLite
assert on the screen                 assert on the rows <────────────┘
```

Proof it matters: making the screen send `quantityMilli` as a string fails 9 of 10 of these tests, but only 2 of 80 fake-based billing tests.

| Use it for | Not for |
|---|---|
| Writes from a screen: bills, lines, tenders, stock movements, drafts, settings | Layout, wording, themes (renderer tests) |
| One transaction, idempotent retry, numbering, snapshots | Electron transport and sender checks (`ipc.test.ts`, e2e) |
| Money the cashier sees equals money saved | Real printing and PDF bytes (`print.test.ts`, e2e) |

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ad9737df3c33b0bb3cf3373038d0d3f0937a2c3ce4050477e574f462e474c07c -->

## 2. Where and how

- Files: `apps/desktop/tests/renderer/integration/*.test.tsx` (the renderer project already runs jsdom there). Shared steps: `billingHarness.tsx` (bills) and `inventoryHarness.ts` (screens, items, stock) beside them.
- Harness: `apps/desktop/tests/helpers/realShopos.ts` comes from [the companion PR (#108)](https://github.com/ganeshmukesh123/shop-os/pull/108), which must be merged before running this recipe:
  - `installRealShopos(options?)` wires `window.shopos` to `buildHandlersFixture()`; only the native dialogs and the printer stay fake.
  - `countRows(table, condition?)` counts rows in the real database.
  - `loseNextReplyOf(commandName)` runs the command for real, then throws as if the reply was lost.
  - `freezeShopClock()` fakes **only `Date`** (18 Nov 2026, 10:30 IST, so the first bill is `C1/26-27/000001`). Timers stay real, so userEvent, Radix and the 300 ms draft autosave keep working. Call `vi.useRealTimers()` in `afterEach`.
  - `createItemDirectly()` arranges data through the handlers when the test is not about item entry.
- Run: `pnpm --filter @shopos/desktop exec node scripts/vitest-electron.mjs run tests/renderer/integration` (Electron's Node; never plain `vitest`, see `shopos-testing` section 6).

## 3. One test, start to finish

```tsx
afterEach(() => {
  vi.useRealTimers();
});

it("IT-BIL-01 saves 2 pipes at ₹120 as one bill, one line, one tender and one sale movement", async () => {
  const realShopos = installRealShopos();
  freezeShopClock();
  await createItemDirectly(realShopos, PIPE); // pcs, ₹120, 10 in stock

  renderShopApp();
  await addToBill("pip", "PVC pipe", "2"); // types, waits for the real search, Enter, quantity
  await choosePayment("UPI");
  await saveWithKeyboard(); // Ctrl+S, as the cashier does

  // Screen: the number came from the real series.
  expect(await screen.findByRole("heading", { name: "Bill saved: C1/26-27/000001" })).toBeTruthy();
  // Rows: what was committed, in integer paise and thousandths.
  expect(readBills(realShopos)).toMatchObject([{ seq: 1, subtotal_paise: 24_000, total_paise: 24_000 }]);
  const sqlite = realShopos.fixture.testDb.sqlite;
  expect(
    sqlite
      .prepare(
        "select item_name_snapshot, unit_snapshot, qty_base_milli, unit_price_paise, amount_paise from bill_line",
      )
      .all(),
  ).toEqual([
    {
      item_name_snapshot: "PVC pipe",
      unit_snapshot: "pcs",
      qty_base_milli: 2_000,
      unit_price_paise: 12_000,
      amount_paise: 24_000,
    },
  ]);
  expect(sqlite.prepare("select mode, amount_paise from bill_tender").all()).toEqual([
    { mode: "upi", amount_paise: 24_000 },
  ]);
  expect(realShopos.countRows("stock_movement", "movement_type = 'sale' and qty_base_milli = 2000")).toBe(1);
  expect(await stockOf(realShopos, "PVC pipe")).toBe(8_000); // stock is the sum of movements
});
```

<!-- /coderabbit-ai-generated:v1 -->

Each test asserts **both** sides: what the screen shows and which rows exist. Stock is read through `items.list` (the sum of movements); a movement's `qty_base_milli` is always positive and `movement_type` gives the direction.

## 4. Recipes for the hard cases

| Case | How |
|---|---|
| Fail halfway through a save (atomicity) | `sqlite.exec("create temp trigger ... before insert on stock_movement when new.movement_type = 'sale' begin select raise(abort, 'disk I/O error'); end")`. Assert zero bill, line, tender and sale rows, unchanged stock, lines still on screen. Drop the trigger, save again, and expect seq 1 (no number used up). |
| Retry after a lost reply (idempotency) | `realShopos.loseNextReplyOf("bills.save")`, save, see the Error, save again. Assert one bill, one line, one movement. |
| Crash recovery | Wait for `countRows("draft_bill")` to be 1, `unmount()`, render again on the same `realShopos`, then answer the "Unsaved bill found" dialog. |
| Two buttons with one name | Scope the query: `within(screen.getByRole("main"))` for the screen, `within(screen.getByRole("navigation", { name: "Main" }))` for the side menu. |

## 5. Pitfalls found while writing these

- **The machine's time zone shows on screen.** The real clock check warns "Time zone differs" when the machine is not on Asia/Kolkata (CI runs on UTC), which is a second `role="alert"`. Never query "the" alert: use `findErrorAlert()` from `billingHarness.tsx`, which picks the Error message by its word. Before pushing, run once with `TZ=UTC`.
- **Faking all timers** freezes userEvent and the draft autosave. Fake only `Date`.
- **The correction count beside Items reloads only when the screen changes.** Open Items before asserting it.
- **Discard does not delete the draft row**: it saves a row with payload `null`, which loads as "no draft". Assert what the user sees (no offer on the next start), not a row count of zero.
- **A quantity field keeps its old value** when typed into; `userEvent.clear` it first.
- **Breaking code to prove a test** (mutation check): on macOS use `perl -pi`, not `sed -i` with `\s`, and revert from a saved copy. Check the edit applied before trusting a green run.

## 6. Case catalogue

Name each test with its ID so the plan and the code match.

| ID | Behaviour | File |
|---|---|---|
| IT-BIL-01 | Bill, line, tender, sale movement, stock 10 → 8 | `billSave` |
| IT-BIL-02 | Lost reply, retry, still one bill | `billSave` |
| IT-BIL-03 | Sell below zero: warning, stock −2, needs correction | `billAmounts` |
| IT-BIL-04 | ₹10 line + 10% bill discount: ₹240 → ₹207 | `billAmounts` |
| IT-BIL-05 | 3 × ₹33.20 = ₹99.60 → ₹100.00, round-off +40 | `billAmounts` |
| IT-BIL-06 | Next bill gets seq 2, number ≤ 16 characters | `billSave` |
| IT-BIL-07 | Saved line keeps ₹120 after a price change | `billSave` |
| IT-BIL-08 | Failure halfway leaves nothing, number not used | `billRecovery` |
| IT-BIL-09 | Draft recovered after close; save clears it | `billRecovery` |
| IT-INV-01 | Add item with opening 10: one `opening` movement | `inventoryScreens` |
| IT-INV-02 | Duplicate name refused; existing item listed | `inventoryScreens` |
| IT-INV-03 | Remove 3 with a note: `adjustment` of 3000, stock 7 | `inventoryScreens` |
| IT-INV-04 | Set count to 8: `adjustment` of 2000 | `inventoryScreens` |
| IT-INV-05 | Set to the current count: no movement | `inventoryScreens` |
| IT-INV-06 | 2.5 metres stored as 2500 | `inventoryScreens` |
| IT-INV-07 | Deactivate: hidden, no movement | `inventoryScreens` |
| IT-SET-01 | New series and format used by the next bill | `settingsScreens` |
| IT-SET-02 | Backup: log row and a copy that holds the bill | `settingsScreens` |

## 7. Checklist

- [ ] Test name starts with its case ID and says the behaviour
- [ ] Arranged through handlers or the screen; never by inserting rows by hand
- [ ] Asserts the screen **and** the rows (paise and thousandths, never rupees)
- [ ] Clock frozen with `freezeShopClock()`; real timers restored after
- [ ] Fresh `installRealShopos()` per test; no shared database
- [ ] Ran three times green, once with `TZ=UTC` (as on CI); for a new write, broken on purpose once to see it fail
