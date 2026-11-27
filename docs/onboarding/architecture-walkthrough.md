# Shop OS: Codebase Architecture Walkthrough (for new joiners)

This is a guide to **the code as it is today** (feature `001-shop-os-mvp`,
commit `f336366` on branch `test/renderer-inventory-and-app-shell`, 22
November 2026). It goes module by module, then follows every main code flow
from the key press to the SQLite row.

**Companion:** `code-walkthroughs.md` in this folder follows every use case
function by function (file and line), with every case: success, cancel, bad
input and each error. Read this guide first, then that one.

`docs/reference/architecture.md` is something else: it describes the
**long-term** system (PostgreSQL server, sync, catalogue engine). Read this
document first and that one later.

The examples all use the same bill, so the numbers line up from start to end:

```
Bill C1/26-27/000123              Shop: My Shop, counter C1
--------------------------------------------------------------
1  Copper wire 1.5 sq mm  2.5 metre x ₹120.50  = ₹301.25
                          line discount         - ₹1.25
                                                  ₹300.00
2  MCB 16A                3 pcs     x ₹183.20  = ₹549.60
--------------------------------------------------------------
   Lines total                                    ₹849.60
   Bill discount                                    ₹0.00
   Round off                                       +₹0.40
   Grand total                                    ₹850.00
   Paid by: Cash
```

---

## Contents

1. [The big picture in one page](#1-the-big-picture-in-one-page)
2. [Repository layout](#2-repository-layout)
3. [The rules everything else serves](#3-the-rules-everything-else-serves)
4. [Module: `packages/core` (business rules)](#4-module-packagescore-business-rules)
5. [Module: database (`main/db` + `drizzle/`)](#5-module-database-maindb--drizzle)
6. [Module: repositories (`main/repositories`)](#6-module-repositories-mainrepositories)
7. [Module: services (`main/services`)](#7-module-services-mainservices)
8. [Module: IPC and preload](#8-module-ipc-and-preload)
9. [Module: app shell and startup (`main/app`)](#9-module-app-shell-and-startup-mainapp)
10. [Module: renderer (React UI)](#10-module-renderer-react-ui)
11. [Code flows, end to end](#11-code-flows-end-to-end)
12. [Errors: how a failure travels](#12-errors-how-a-failure-travels)
13. [Testing](#13-testing)
14. [Tooling, CI and commands](#14-tooling-ci-and-commands)
15. [How to add a new command](#15-how-to-add-a-new-command)
16. [Not built yet, and traps for the unwary](#16-not-built-yet-and-traps-for-the-unwary)
17. [Why it is built this way](#17-why-it-is-built-this-way)
18. [Glossary](#18-glossary)
19. [Resources to learn](#19-resources-to-learn)

---

## 1. The big picture in one page

Shop OS is an **offline desktop app** (Electron) for one hardware shop. Everything
runs on the counter PC: there is no server. Data lives in one SQLite file.

Electron gives us two kinds of process, and we add one hidden window:

```
+------------------------- Electron app ---------------------------+
|                                                                  |
|  RENDERER (Chromium, sandboxed)     MAIN (Node.js)               |
|  React + Radix UI                   SQLite, files, dialogs       |
|  NO Node, NO database        IPC    Services, repositories       |
|  window.shopos.*  ---------------->  one channel "shopos:invoke" |
|        ^            <---------------  Result {ok, data | code}   |
|        |                                  |                      |
|  PRELOAD (bridge)                          +--> OFFSCREEN window |
|  exposes exactly the                           (prints a bill,   |
|  commands in the contract                       no JavaScript)   |
+------------------------------------------------------------------+
                                   |
                                   v
                    userData/shopos.sqlite  (+ -wal, -shm)
                    <backup folder>/shopos-YYYYMMDD-HHMMSS.sqlite
```

Inside the main process the code is in layers. A layer may only call the one
below it, and every layer may use `@shopos/core`:

```
Screen --> typed API --> IPC handler --> Service --> Repository --> SQLite
(React)    (preload)     (validate)      (use case,   (Drizzle
                                          transaction) queries)
                                           |
                                           +--> @shopos/core (pure rules)

Example: save bill C1/26-27/000123  (2.5 m wire + 3 MCB = ₹850.00)
```

| Layer | Folder | Knows about | Must NOT know about |
|---|---|---|---|
| Core | `packages/core/src` | numbers, strings, Zod | Electron, DB, React |
| Renderer | `apps/desktop/src/renderer` | React, Radix, core | DB, Node, main |
| Preload | `apps/desktop/src/preload` | `ipcRenderer`, command list | everything else |
| IPC | `apps/desktop/src/main/ipc` | services, Zod schemas | SQL |
| Services | `apps/desktop/src/main/services` | repositories, core | IPC, React |
| Repositories | `apps/desktop/src/main/repositories` | Drizzle, schema | IPC, UI |
| App shell | `apps/desktop/src/main/app` | Electron APIs, wiring | business rules |

These boundaries are **enforced by ESLint** (`no-restricted-imports` in
`eslint.config.js`): core cannot import Electron or the DB, and the renderer
cannot import anything from `main/`, Node or the database.

---

## 2. Repository layout

```
shop-os-v2/
|-- packages/
|   `-- core/                 @shopos/core: pure TypeScript rules
|       |-- src/              money, quantity, billing, stock, ...
|       `-- tests/            Vitest, plain Node
|-- apps/
|   `-- desktop/              @shopos/desktop: the Electron app
|       |-- src/
|       |   |-- main/         Node side
|       |   |   |-- index.ts      entry: hands real Electron to startApp
|       |   |   |-- app/          startup, window, shell, backups
|       |   |   |-- db/           schema, connection, seed, safety
|       |   |   |-- ipc/          channel + handlers
|       |   |   |-- repositories/ one class per table group
|       |   |   `-- services/     one class per use-case group
|       |   |-- preload/      the window.shopos bridge
|       |   `-- renderer/     React app
|       |       |-- app/          App shell (nav), clock warnings
|       |       |-- features/     billing, inventory, settings
|       |       `-- shared/       api, toast, status, theme, text
|       |-- drizzle/          generated SQL migrations 0000..0014
|       |-- tests/            unit, integration, renderer, e2e
|       `-- scripts/          Electron-ABI SQLite helpers
|-- specs/                    one folder per feature (Spec Kit)
|-- docs/                     PRD, architecture, design, guides
|-- scripts/                  CI helpers, pr-size
`-- .specify/memory/constitution.md   the rules that override all
```

`pnpm-workspace.yaml` links the two packages, so the desktop app imports
`@shopos/core` like any npm package, and the preload imports the narrow
`@shopos/core/commands` entry.

---

## 3. The rules everything else serves

Most design choices in the code exist to protect these rules (full text in
`.specify/memory/constitution.md`). When code looks over-careful, it is usually
one of these.

| Rule | Where it is enforced in code |
|---|---|
| Money is integer **paise**, quantity integer **thousandths** | `core/money.ts`, `core/quantity.ts`, Zod `int()` |
| Saved bills, lines, stock movements are never edited or deleted | SQL triggers (`drizzle/0001`, `0013`, `0014`), insert-only repositories |
| Bill + lines + stock movements save in ONE transaction | `BillingService.saveBill` |
| Print only after the commit | `PrintService` reads, never writes; screen prints from `BillView` |
| Stock = sum of movements | `StockRepository.append` + `ItemRepository.addStockDelta` together |
| Bill numbers consecutive, unique per FY, at most 16 chars | `number_series` upsert, unique indexes, `validateNumberTemplate` |
| Every table has UUID `id`, `business_id`, `shop_id` | `base` columns in `schema.ts` |
| Back up only with SQLite's online backup API | `sqlite.backup()` in `BackupService` and `startupSafety` |
| Business rules in core only | ESLint layering |

Why integers? Floating point cannot hold 0.1 exactly:

```
Float:   0.1 + 0.2            = 0.30000000000000004   (wrong bill)
Paise:   10  + 20             = 30                    (₹0.30, exact)
Qty:     2.5 metre            = 2500 milli
Amount:  2500 x 12050 / 1000  = 30125 paise = ₹301.25
```

---

## 4. Module: `packages/core` (business rules)

Pure functions. No I/O, no clock reads (time is passed in), no Electron, no
database. Runs in plain Node, so its tests are fast and need no native code.
Everything is re-exported from `packages/core/src/index.ts`.

```
packages/core/src/
|-- money.ts         paise maths, rounding, ₹ formatting
|-- quantity.ts      thousandths, units, parsing
|-- billing.ts       line amount, bill totals
|-- draftBill.ts     evaluate a half-typed bill (never throws)
|-- stock.ts         movement direction, folding, invariant
|-- numbering.ts     bill number format, template check
|-- numberGap.ts     read a bill number back; plan a restore gap
|-- businessDate.ts  shop time zone -> date and financial year
|-- clockCheck.ts    "your clock looks wrong" warnings
|-- types.ts         entities + Zod input schemas + Result
|-- commands.ts      the IPC contract: name -> [input, output]
`-- errors.ts        ErrorCode list + CoreError
```

### 4.1 `money.ts`

| Function | What it does | Example |
|---|---|---|
| `mulQtyRate(qtyMilli, ratePaise)` | qty x rate, half up, via `BigInt` | `2500, 12050 -> 30125` |
| `percentOfPaise(paise, bp)` | percent in basis points, half up | `54960, 1000 (10%) -> 5496` |
| `roundBillTotal(total, on)` | nearest rupee, 50 paise and up rounds up | `84960 -> +40, 85000` |
| `formatRupees(paise)` | Indian grouping | `10000000 -> ₹1,00,000.00` |
| `parseRupees(text)` | form text to paise, `null` if bad | `"1,234.50" -> 123450` |
| `paiseToInput(paise)` | paise to form text | `12050 -> "120.50"` |

`BigInt` is used inside multiplication so that `qty x rate` cannot lose
precision before the division. Every result passes `assertPaise`
(`Number.isSafeInteger`), or a `CoreError("INVALID_AMOUNT")` is thrown.

Round off keeps line amounts exact and stores the difference separately:

```
lines total 849.60 --> leftover 60 >= 50 --> round off +40 --> 850.00
lines total 849.49 --> leftover 49 <  50 --> round off -49 --> 849.00
rounding off        -->                       round off   0 --> 849.60
```

### 4.2 `quantity.ts`

Quantity is thousandths of the unit. `metre`, `kg`, `litre` allow decimals by
default (`defaultAllowsDecimal`); `pcs` and `box` do not.

```
parseQuantity("2.5")   -> 2500        formatQuantity(2500) -> "2.5"
parseQuantity("3")     -> 3000        formatQuantity(1)    -> "0.001"
isValidQuantity(2500, allowsDecimal=false) -> false
                                     ("whole numbers only")
```

### 4.3 `billing.ts`

```
computeLine({quantityMilli, ratePaise, lineDiscountPaise})
   gross = mulQtyRate(qty, rate)            2500 x 12050 -> 30125
   0 <= discount <= gross, else INVALID_DISCOUNT
   return gross - discount                  30125 - 125  -> 30000

computeBill({lines, billDiscountPaise})
   no lines -> EMPTY_BILL
   lineAmounts      = [30000, 54960]
   linesTotalPaise  = 84960
   0 <= billDiscount <= linesTotal
   grandTotalPaise  = 84960 - 0 = 84960     (rounding happens later)
```

### 4.4 `draftBill.ts`: the screen's live calculator

While the cashier types, inputs are raw strings (`"2."`, `""`, `"10%"`).
`evaluateDraft(draft)` turns them into numbers with **the same core rules** used
on save, but it **never throws**: every problem becomes a message.

```
DraftBill (strings)                DraftEvaluation
+---------------------------+      +-------------------------------+
| line 1 qty "2.5"          |      | lines[0] amount 30000, ok     |
|        rate "120.50"      | ---> | lines[1] amount 54960, ok     |
|        disc "1.25" rupees |      | linesTotal 84960              |
| line 2 qty "3" rate "183.2"|     | errors []   valid true        |
| billDisc ""               |      | input [wire-format lines]     |
+---------------------------+      +-------------------------------+

If line 2 qty was "2.5" for pcs:
   lines[1].error = "This unit accepts whole numbers only"
   errors = ["Fix the highlighted lines"], valid = false, input = null
```

`input` is present only when the bill is valid; it is exactly what the screen
sends to `bills.save`. The main process recomputes everything anyway: the
renderer's numbers are a preview, never trusted.

### 4.5 `stock.ts`

A stored movement has a **positive** quantity, and direction is told by which
location is set (this is ready for godowns in feature 007):

```
signed change   stored as                     meaning
+10 000         qty 10000, to = ShopFloor     stock in (opening)
 -2 500         qty  2500, from = ShopFloor   stock out (sale)

movementLocations(-2500, "loc-1")
   -> { qtyBaseMilli: 2500, fromLocationId: "loc-1", toLocationId: null }
signedQuantityMilli(that) -> -2500
```

`foldMovements` sums movements per item; `checkInvariant(cached, movements)`
lists items whose cached `stock_milli` differs from the sum (used in tests).

### 4.6 `numbering.ts` and `businessDate.ts`

The bill number template default is `{series}/{fy}/{seq}`; `seq` is padded to 6.

```
businessDateOf(instantMs, "Asia/Kolkata")   -> "2026-11-22"
financialYearOfBusinessDate("2026-11-22")    -> "26-27"
formatBillNumber("{series}/{fy}/{seq}", "C1", "26-27", 123)
                         -> "C1/26-27/000123" (15 chars)
```

The **shop's** named zone is always used, never the PC's zone. A bill saved at
00:30 IST on 1 April belongs to the new financial year even if the PC is set
to London time.

`validateNumberTemplate(template, series, now, zone)` refuses a template that:
has no `{seq}`, uses characters other than letters, digits, `-` and `/`, or
could exceed 16 characters in the worst case (`seq` 999999, FY `99-00`).

### 4.7 `numberGap.ts`: numbers lost in a restore

If the owner restores yesterday's backup, bills printed after it are gone from
the database but are still in customers' hands. Their numbers must never be
issued again.

```
parseBillNumber("{series}/{fy}/{seq}", "C1/26-27/000126")
   -> { seriesCode: "C1", financialYear: "26-27", seq: 126 }

planNumberGap(restoredLastSeq=120, lastIssuedSeq=126)
   -> { seqFrom: 121, seqTo: 126, newLastSeq: 126, isEstimated: false }
       next bill = 127

planNumberGap(120, null)          owner cannot say
   -> { seqFrom: 121, seqTo: 220, newLastSeq: 220, isEstimated: true }
       next bill = 221            (UNCONFIRMED_GAP_SIZE = 100)

planNumberGap(120, 120) -> null   nothing lost
planNumberGap(120, 110) -> INVALID_FIELD  ("older than the backup")

assertNotAfterCurrentYear("27-28", "26-27")  -> INVALID_FIELD
   (that year has not started yet)
assertNotBeforeBackupYear("25-26", "26-27")  -> INVALID_FIELD
   (older than the backup's last bill)
```

### 4.8 `clockCheck.ts`

`findClockWarnings` returns warnings only (never blocks billing):

- `TIME_ZONE_DIFFERS`: the PC's UTC offset now differs from the shop zone's.
  `Asia/Calcutta` and `Asia/Kolkata` agree, so they do not warn.
- `CLOCK_BEFORE_LAST_BILL`: "now" is earlier than the newest saved bill, so
  the clock went back.

### 4.9 `types.ts`, `commands.ts`, `errors.ts`: the contract

- **Entities** (`Item`, `Bill`, `BillLine`, `StockMovement`, `ShopProfile`) are
  what screens see. They use friendly names (`number`, `pricePaise`); the
  database uses other names (`bill_no`, `selling_price_paise`). Repositories
  translate.
- **Zod schemas** (`billsSaveInput`, `itemsCreateInput`, ...) validate every
  command input in the main process.
- **`Result<T>`** = `{ ok: true, data }` or `{ ok: false, code, message, details? }`.
- **`CommandMap`** in `commands.ts` maps each command name to `[input, output]`.
  `COMMAND_NAMES` is the runtime list; `ShopOsApi` is the typed
  `window.shopos` object. Add a command here first (see section 15).
- **`ErrorCode`** is the closed list of failure codes; `CoreError(code, msg)`
  is what rules throw.

---

## 5. Module: database (`main/db` + `drizzle/`)

```
main/db/
|-- schema.ts           Drizzle table definitions (source of truth)
|-- connection.ts       open, pragmas (WAL, foreign keys), migrate
|-- migrateValidated.ts Drizzle migrator + foreign_key_check before COMMIT
|-- startupSafety.ts    integrity check, pre-migration backup
|-- seed.ts             first run: profile + "Shop floor"; Ctx
`-- ids.ts              UUID v7, epoch-ms clock helpers
drizzle/
|-- 0000_...sql .. 0014_bill_number_gap.sql
`-- meta/_journal.json  migration order + timestamps
```

### 5.1 Tables and how they relate

Every table has `id` (UUID v7, time-ordered), `business_id`, `shop_id`,
`created_at`, `updated_at` (epoch milliseconds, integers).

```
  item_family 1---* item_variant 1---* stock_movement *---1 location
                         |  1                |  (doc_id when sale)
                         |                   v
                         *              bill 1---* bill_line
                     bill_line          |  1
                                        +---1 bill_tender
                                        |
                       number_series 1--*  (bill.number_series_id)
                             1
                             |
                             *
                       bill_number_gap

  shop_profile (one row: settings + device id)
  draft_bill   (0 or 1 row: the bill being typed, JSON)
  backup_log   (every backup attempt)
```

| Table | Holds | Example row (short) |
|---|---|---|
| `item_family` | the product's family (1 per item today) | `name "MCB 16A"` |
| `item_variant` | sellable item: code, unit, price, cached stock | `ITM-0002, pcs, 18320, stock 7000` |
| `location` | where stock sits; one seeded "Shop floor" | `kind shop_floor` |
| `stock_movement` | every stock change, append-only | `sale, qty 3000, from shop floor, doc bill/…` |
| `bill` | bill header, plus the doc title and time zone used when saved | `C1/26-27/000123, subtotal 84960, round +40, total 85000, Asia/Kolkata` |
| `bill_line` | lines with name/unit **snapshots** | `line 1, "Copper wire…", 2500 x 12050` |
| `bill_tender` | how it was paid (a label today) | `mode cash, 85000, status label` |
| `number_series` | counter per counter+FY | `C1, 26-27, last_seq 123` |
| `bill_number_gap` | numbers lost in a restore; confirmed or a guess | `seq 121..126, lost_in_restore, is_estimated 0` |
| `shop_profile` | settings, device id | `C1, "{series}/{fy}/{seq}", Asia/Kolkata` |
| `draft_bill` | crash-recovery JSON | `{clientBillId, draft, ...}` |
| `backup_log` | backup history | `ok, path …/shopos-20261122-143000.sqlite` |

Why snapshots on `bill_line`? If the item is renamed from "MCB 16A" to
"MCB 16A Havells" next month, the old bill must still print what the customer
received. The line stores `item_name_snapshot` and `unit_snapshot`.

### 5.2 What the database enforces by itself

The app checks rules in core, and the database checks them again, so a bug in
a service cannot write a wrong bill.

```
CHECK  bill_total_eq   total = subtotal - bill_discount + round_off
                       85000 = 84960   - 0             + 40    OK
CHECK  bill_round_off_range        |round_off| <= 50
CHECK  bill_no_len                 length(bill_no) <= 16
CHECK  stock_movement_one_direction  exactly one of from / to
CHECK  stock_movement_adjustment_note  adjustment needs a note
UNIQUE (shop_id, bill_no)
UNIQUE (counter_code, financial_year, seq)
UNIQUE (shop_id, client_bill_id)      idempotent save
```

Immutability triggers (`RAISE(ABORT, ...)`):

| Table | Update | Delete |
|---|---|---|
| `bill` | only `posted -> cancelled` with every other column equal (`bill_only_cancel_update`) | never |
| `bill_line` | never | never |
| `bill_tender` | never | never |
| `stock_movement` | never | never |
| `bill_number_gap` | never | never |

```
UPDATE bill SET total_paise = 80000 WHERE ...
   -> ABORT "a saved bill can only be cancelled, not edited"
```

### 5.3 Connection and migrations

`connection.ts`:

- `applyConnectionPragmas`: `journal_mode = WAL` for files (not for
  `:memory:` tests), `foreign_keys = ON`.
- `migrateConnection`: turns foreign keys **off**, runs migrations, turns them
  back **on**. SQLite rebuilds a table with create-copy-drop-rename, which
  breaks references mid-way; `PRAGMA foreign_keys` cannot change inside a
  transaction, so it is switched before Drizzle's single migration transaction.
- `migrateValidated.ts` subclasses Drizzle's session so that just before
  `COMMIT` it runs `PRAGMA foreign_key_check`. Any broken reference throws, and
  Drizzle rolls the whole upgrade back.

```
foreign_keys OFF
BEGIN
  0013 ... 0014  (rebuild tables, copy rows)
  foreign_key_check --> broken? yes --> throw --> ROLLBACK
                                                  (old DB intact)
                                 no  --> COMMIT
foreign_keys ON
```

Change the schema like this: edit `schema.ts`, then
`pnpm --filter @shopos/desktop db:generate`. Hand-written SQL (triggers, data
moves) goes into a migration file too. CI's `check:migrations` fails if
`schema.ts` and the SQL disagree.

### 5.4 Seed and `Ctx`

On first run `ensureSeed` creates, in one transaction, the `shop_profile` row
(new `businessId`, `shopId`, `deviceId`; name "My Shop", series C1, 80 mm
paper) and the "Shop floor" `location`. Every later start reads those ids back.

```ts
interface Ctx { businessId: string; shopId: string; deviceId: string }
```

Every repository takes `Ctx` in its constructor and stamps these ids on each
row it inserts. This is why the data is ready for many shops later.

---

## 6. Module: repositories (`main/repositories`)

A repository is the **only** place with Drizzle queries. It translates between
database rows and core entities. It takes a `Handle`: either the database or an
open transaction, so a service can put several repositories in one transaction.

```ts
// connection.ts
type Handle = DB | <the transaction object Drizzle passes in>
```

| Repository | Tables | Main methods |
|---|---|---|
| `ItemRepository` | `item_family`, `item_variant` | `create`, `update`, `get`, `list`, `findActiveByName`, `addStockDelta`, `countNeedingCorrection` |
| `StockRepository` | `stock_movement`, `location` | `append` (no update/delete!), `sumForItem`, `forItem`, `forBill`, `all` |
| `BillRepository` | `bill`, `bill_line`, `bill_tender`, `number_series`, `draft_bill` | `nextSeq`, `insertBill`, `insertLines`, `findByClientBillId`, `get`, `saveDraft`, `loadDraft`, `clearDraft`; exports `toBill` |
| `BillSearchRepository` | `bill`, `bill_tender` | `list` (filters, newest first, page of at most 500) |
| `BillCancelRepository` | `bill` | `markCancelled` (the only UPDATE a saved bill may get) |
| `SettingsRepository` | `shop_profile` | `get`, `update` |
| `BillClockRepository` | `bill` | `lastBilledAt` |
| `NumberGapRepository` | `number_series`, `bill_number_gap` | `ensureSeries`, `recordGap`, `setLastSeq` |
| `BackupLogRepository` | `backup_log` | `append`, `lastSucceeded`, `lastAttempt` |
| `BackupInspectionRepository` | a backup FILE (raw better-sqlite3) | `readNumberingSettings`, `latestFinancialYear`, `lastSeq` (works on old schemas too) |

### 6.1 Name translation (example: `BillRepository.toBill`)

```
DB column            -> entity field
bill_no              -> number            "C1/26-27/000123"
counter_code         -> seriesCode        "C1"
subtotal_paise       -> linesTotalPaise   84960
total_paise          -> grandTotalPaise   85000
billed_at (epoch ms) -> billDate          "2026-11-22T14:30:05"
                                          (in bill.time_zone, the zone
                                           stored when it was saved)
bill_tender.mode     -> paymentMode       "cash"
```

`ItemRepository.toItem` does the same for items, and derives
`needsCorrection = stockMilli < 0`.

### 6.2 The bill number counter (`BillRepository.nextSeq`)

One SQL statement, so two saves can never get the same number:

```sql
INSERT INTO number_series (..., counter_code, financial_year, last_seq)
VALUES (..., 'C1', '26-27', 1)
ON CONFLICT (shop_id, counter_code, financial_year)
DO UPDATE SET last_seq = last_seq + 1
RETURNING last_seq, id;
```

```
first bill of 26-27   no row  -> insert last_seq 1   -> 000001
bill 123              row 122 -> update to 123        -> 000123
1 April 2027          new FY "27-28", no row -> 1     -> C1/27-28/000001
```

It runs inside the bill-save transaction. If the save rolls back, the counter
rolls back too, so no number is skipped.

### 6.3 Item search (`ItemRepository.list`)

`LIKE '%term%'` with `COLLATE NOCASE`, `%` and `_` escaped, names that **start**
with the term ranked first, then alphabetical. Item codes are
`ITM-0001`, `ITM-0002`, ... (max existing + 1 per business).

```
search "mcb"  ->  "MCB 16A", "MCB 32A"    (start with "mcb")
                  "Havells MCB box"       (contains "mcb")
```

---

## 7. Module: services (`main/services`)

A service is one group of **use cases**. It validates input again with Zod,
applies core rules, and owns the **transaction**. Services are plain classes
built once at start-up with `(db, ctx)`.

```
main/services/
|-- InventoryService.ts      create/update item, adjust stock, list
|-- BillingService.ts        save, list, get, cancel bill; draft
|-- SettingsService.ts       get/update settings, clock check
|-- PrintService.ts          print, export PDF (reads only)
|-- billHtml.ts              bill -> escaped HTML, page sizes
|-- electronRenderer.ts      offscreen window: print / printToPDF
|-- BackupService.ts         backup, prune, status, validate, restore
`-- RestoreNumbering/        plan + apply the number gap on restore
    |-- RestoreNumbering.ts
    |-- backupCopy.ts        read a temp copy, never the backup
    |-- RestoreNumbering.types.ts
    |-- RestoreNumbering.constants.ts
    `-- index.ts
```

| Service | Writes in one transaction | Core rules used |
|---|---|---|
| `InventoryService.createItem` | family + variant + `opening` movement + cached stock | `assertQuantity`, `defaultAllowsDecimal` |
| `InventoryService.adjustStock` | `adjustment` movement + cached stock | `assertQuantity` |
| `BillingService.saveBill` | number, bill, tender, lines, `sale` movements, cached stock, clear draft | `computeBill`, `roundBillTotal`, `businessDateOf`, `formatBillNumber` |
| `BillingService.cancelBill` | bill posted → cancelled, `sale_cancel` movements, stock given back | none (reason required) |
| `SettingsService.update` | profile row | `validateNumberTemplate` |
| `BackupService.run` | `backup_log` row (backup itself is a file) | none |
| `restoreWithNumbering` | on a prepared copy: series + gap + counter | `planNumberGap`, `parseBillNumber`, `assertNotBeforeBackupYear`, `assertNotAfterCurrentYear` |

`PrintService` takes its dependencies as small interfaces (`Pick<BillRepository,
"get">`, `HtmlRenderer`), so tests pass fakes and never open a real window.

Detailed flows for each are in section 11, and function by function in
`code-walkthroughs.md`.

---

## 8. Module: IPC and preload

### 8.1 One channel, a sender check, an allow-list

```
renderer              preload               main
window.shopos         buildShopOsApi        registerIpc
["bills.save"](in) -> ipcRenderer.invoke -> ipcMain.handle(
                      ("shopos:invoke",       "shopos:invoke", ...)
                       "bills.save", in)            |
                                  main frame on a trusted page?
                                    no  -> {ok:false, INTERNAL,
                                            "Command refused"}
                                  name in COMMAND_NAMES?
                                    no  -> {ok:false, INTERNAL,
                                            "Unknown command"}
                                    yes -> handlers[name](in)
```

- `preload/bridge.ts` builds one function per entry in `COMMAND_NAMES`, and
  nothing else. `contextBridge.exposeInMainWorld("shopos", ...)` puts it on
  `window`. The page never sees `ipcRenderer`.
- `main/ipc/index.ts` registers the single channel. It first checks the
  sender (`ipc/senderPolicy/`): only the window's **main frame** showing the
  app's own `index.html` (or the dev server in `pnpm dev`) may send commands.
  Addresses are parsed and compared by scheme, host and path, never by text
  prefix. A refusal logs only the sender's scheme and host, never the input.
- `main/ipc/handlers.ts` has one handler per command, grouped into item, bill
  and system handlers. `main/ipc/restoreCommands.ts` holds the restore plan
  and confirmation helpers.

### 8.2 The `cmd` wrapper: validate, run, turn errors into data

```ts
cmd(schema, run) = async (raw) => {
  try {
    const input = schema.parse(raw);
    return { ok: true, data: await run(input) };
  } catch (error) {
    return toFailure(error);
  }
};
```

Handlers **never throw** across IPC. `toFailure` maps:

| Thrown | Becomes |
|---|---|
| `CoreError("EMPTY_BILL", msg)` | `{ ok:false, code:"EMPTY_BILL", message: msg }` |
| `ZodError` | `{ ok:false, code:"INVALID_FIELD", message: "issue; issue" }` |
| anything else | logged; `{ ok:false, code:"INTERNAL", "Something went wrong. Nothing was lost; please try again." }` |

### 8.3 The `Shell` interface

Some commands need things only Electron can do: native dialogs and restart.
Handlers receive these as an injected `Shell` (`pickFolder`, `pickBackupFile`,
`pickPdfPath`, `scheduleRestore`) built by `app/shell.ts`. Tests pass a fake.

### 8.4 The command list today

| Command | Service call | Writes? |
|---|---|---|
| `items.list` | `inventory.listItems` | no |
| `items.create` | `inventory.createItem` | yes |
| `items.update` | `inventory.updateItem` | yes |
| `stock.adjust` | `inventory.adjustStock` | yes |
| `bills.draft.save` / `.load` | `billing.saveDraft` / `loadDraft` | draft only |
| `bills.save` | `billing.saveBill` | yes |
| `bills.list` | `billing.listBills` | no (no screen yet) |
| `bills.get` | `billing.getBill` | no |
| `bills.cancel` | `billing.cancelBill` | yes (no screen yet) |
| `bills.print` / `bills.exportPdf` | `print.print` / `exportPdf` | PDF file only |
| `settings.get` / `.update` | `settings.get` / `update` | update yes |
| `settings.clockCheck` | `settings.clockCheck` | no |
| `backup.run` / `.status` | `backup.run` / `status` | backup file + log |
| `backup.planRestore` | validate, plan the number gap from a temp copy | no |
| `backup.restore` | plan again, must equal the confirmed plan, `shell.scheduleRestore` | replaces DB, restarts |
| `system.pickFolder` / `pickBackupFile` / `pickPdfPath` | `shell.*` | no |

The written contract is `specs/001-shop-os-mvp/contracts/ipc-commands.md`;
`CommandMap` in core is its typed form.

---

## 9. Module: app shell and startup (`main/app`)

```
main/
|-- index.ts            entry: passes real Electron objects in
`-- app/
    |-- startApp.ts     the start-up sequence and wiring
    |-- appConfig.ts    paths, dev vs packaged, backup interval
    |-- appState.ts     what lives between start, timer, restore, quit
    |-- mainWindow.ts   window options, navigation guard
    |-- navigationPolicy/   which addresses the window may show
    |-- permissionPolicy/   deny every permission (allow-list empty)
    |-- securityHeaders.ts  Content-Security-Policy
    |-- shell.ts        dialogs + restore-and-relaunch
    |-- backupLifecycle.ts  15-minute timer, backup on quit
    `-- startupRecovery.ts  damaged database -> offer restore
```

`index.ts` contains no logic. It hands `app`, `dialog`, `BrowserWindow` and
`session` to `startApp`, which takes them as **arguments**. That is why the
start-up can be tested with fakes (`tests/integration/startApp.test.ts`).

`appConfig.ts` decides where things are:

| | Dev (`pnpm dev`) | Packaged |
|---|---|---|
| Database | `userData/shopos-dev.sqlite` (throwaway) | `userData/shopos.sqlite` |
| Migrations | `apps/desktop/drizzle` | `resources/drizzle` |
| Page | Vite dev server URL | `renderer/index.html` |
| CSP | relaxed for Vite | strict, `connect-src 'none'` |

`SHOPOS_USER_DATA` overrides the data folder (tests use it).

Security defaults (`mainWindow.ts`, `navigationPolicy/`, `permissionPolicy/`,
`securityHeaders.ts`, `ipc/senderPolicy/`):

```
webPreferences: contextIsolation true, sandbox true,
                nodeIntegration false
window.open         -> denied
navigate / redirect -> blocked unless it is the app's own
                       index.html (or the dev server)
permission requests -> refused (camera, mic, notifications...)
every response      -> Content-Security-Policy header
IPC from elsewhere  -> "Command refused"
print window        -> also javascript: false
```

`IAppState` holds the open connection, `Ctx`, the `BackupService`, the backup
timer and `isQuitting`. It is the only mutable state in the main process.

---

## 10. Module: renderer (React UI)

Every component and hook has its own folder (code, `types.ts`,
`constants.ts`, tests). Things used by one feature stay in that feature;
only things used across features go in `shared/`.

```
renderer/
|-- app/
|   |-- main.tsx          <ThemeProvider><ToastProvider><App/>
|   |-- App/              left nav + route state, Ctrl/Cmd+1..3
|   `-- ClockWarnings/    banner + useClockWarnings
|-- features/
|   |-- billing/
|   |   |-- NewBillScreen/        the screen, composed of:
|   |   |   |-- components/       BillSearchBox, BillLinesTable,
|   |   |   |                     BillSummaryPanel, RecoverDraftDialog
|   |   |   `-- hooks/            useBillForm, useBillSave,
|   |   |                         useItemSearch, useQuantityFocus
|   |   |-- BillView/             saved bill: print, PDF, new bill
|   |   |-- BillLineRow/          one editable line
|   |   |-- RoundOffLine/         round-off line + useRoundedTotal
|   |   |-- billForm/             IBillForm, emptyForm, loadDraftForm
|   |   `-- hooks/useDraftAutosave/
|   |-- inventory/
|   |   |-- ItemsScreen/          list, search, filters
|   |   |-- ItemForm/             add/edit dialog: useItemFormFields,
|   |   |                         useItemFormSave, validateItemForm
|   |   |-- AdjustStockDialog/
|   |   `-- hooks/useItems/
|   `-- settings/
|       |-- SettingsScreen/       shop, numbering, backup, theme
|       |-- BillSettingsFields/   title, rounding, zone, paper
|       `-- RestoreBackupDialog/  dialog + useRestoreBackup + texts
`-- shared/
    |-- api/api.ts        call(name, input) -> data | throw ApiError
    |-- components/       Toast, StatusMessage, StatusBadge
    |-- constants/layout.ts  sizes Radix tokens cannot express
    |-- text/strings.ts   uiText: every visible string (+ fillText)
    `-- theme/            ThemeProvider, ThemePicker, preference
```

Screens are thin: state and calls live in hooks (`useBillForm`,
`useBillSave`, `useRestoreBackup`), and components only take props and draw.

### 10.1 Calling the main process

Screens never touch `window.shopos` directly; they use `call`:

```ts
const saved = await call("bills.save", { clientBillId, ... });
// ok: returns data, fully typed from CommandMap
// not ok: throws ApiError
//   { code: "ITEM_INACTIVE", message: "MCB 16A is inactive" }
```

The `ApiError.code` lets a screen react differently (for example `BillView`
adds a hint unless the code is `PRINT_FAILED`).

### 10.2 Navigation

There is no router library. `App.tsx` keeps `route: "items" | "bill" |
"settings"` in state. On every route change it also:

- counts items with negative stock (`items.list` with `needsCorrection`) and
  shows a "Needs correction" badge on Items;
- re-runs the clock check (`useClockWarnings(route)`).

### 10.3 Theme

`useThemeController` reads the saved choice (System / Light / Dark) from
browser storage on the first render, follows the OS through
`useSystemDarkMode`, and passes the resolved `appearance` to Radix `<Theme>`.
Colours come only from Radix tokens; no hex colours and no inline `style`
(ESLint warns). Printed bills are always light (they are separate HTML).

### 10.4 Screen text

All words come from `uiText` in `shared/text/strings.ts`, so Hindi can be
added in one place later. `fillText("{name} saved", {name})` fills the
placeholders:

```tsx
<Heading size="6">{uiText.bill.title}</Heading>
```

---

## 11. Code flows, end to end

These are the flows at the level of layers. For the same flows **function by
function with file:line and every case** (plus the ones not here: item list,
edit, deactivate, draft recovery, PDF, back up now, theme, security guards),
see `code-walkthroughs.md`:

| Flow here | Walkthrough there |
|---|---|
| 1 start | W1 |
| 2 add item | W4 (also W3, W5, W6) |
| 3 adjust stock | W7 |
| 4 typing a bill | W8, W9, W10, W11 |
| 5 save bill | W12 |
| 6 print / PDF | W13, W14 |
| 7 backups | W18, W19 |
| 8 restore | W20 |
| 9 damaged DB | W21 |
| 10 clock check | W22 |
| 11 settings | W16, W17 |

### Flow 1: the app starts

```
index.ts
  applyUserDataOverride  (SHOPOS_USER_DATA for tests)
  startApp(real Electron, readAppConfig(...))
   |
   +- registerQuitHooks           (before anything can fail)
   +- app.whenReady()
   +- openShopDatabase
   |    mkdir userData
   |    openCheckedSqlite --- integrity_check != "ok"
   |    |                        --> CoreError DATABASE_CORRUPT --> Flow 9
   |    |  ok: WAL + foreign keys
   |    needsPreMigrationBackup?  (shop has tables AND journal newer
   |    |                          than __drizzle_migrations)
   |    |  yes: sqlite.backup() -> pre-migration-backups/
   |    |       shopos-pre-migrate-20261122-093000.sqlite (keep 5)
   |    migrateConnection         (section 5.3)
   |    ensureSeed -> Ctx
   +- buildServices(state)        Inventory, Billing, Settings,
   |                              Print, Backup
   +- installSecurityHeaders      CSP
   +- installPermissionPolicy     refuse every permission
   +- registerIpc(services, createShell(...))
   +- createMainWindow            loads the React page
   +- startBackupTimer            every 15 minutes
   `- on "activate": reopen window (macOS)
   any other error --> error box "Shop OS could not start", exit(1)
```

Example: the owner installs version 0.2 over 0.1. On start the journal has
migration 0014 but the database stops at 0013. A copy
`pre-migration-backups/shopos-pre-migrate-20261122-093000.sqlite` is written
first, then 0014 runs. If 0014 fails, nothing changed and the copy exists.

### Flow 2: add an item with opening stock

The owner adds "Copper wire 1.5 sq mm", unit metre, ₹120.50, opening 100 m.

```
ItemForm.save
  call("items.create", { name, unit:"metre",
        pricePaise:12050, openingQtyMilli:100000 })
   |
handlers "items.create"  -> itemsCreateInput.parse
   |
InventoryService.createItem
  allowsDecimal = defaultAllowsDecimal("metre") = true
  assertQuantity(100000, true)
  BEGIN
    findActiveByName("Copper wire 1.5 sq mm")  -> found? DUPLICATE_NAME
    ItemRepository.create
       INSERT item_family  (name)
       INSERT item_variant (ITM-0001, metre, 12050, stock 0)
    StockRepository.append  opening, +100000
       INSERT stock_movement (qty 100000, to = Shop floor)
    ItemRepository.addStockDelta(+100000)
       UPDATE item_variant SET stock_milli = stock_milli + 100000
  COMMIT
  <- { item: { id, name, stockMilli: 100000, ... } }
```

If any step throws, the whole transaction rolls back: there is never an item
whose stock does not match its movements.

### Flow 3: adjust stock

The owner counts 95 m of wire, so chooses **Set to** 95 with note "Count 22 Nov".

```
AdjustStockDialog -> call("stock.adjust",
   { itemId, mode:"set", quantityMilli:95000, note:"Count 22 Nov" })
InventoryService.adjustStock
  note empty?            -> NOTE_REQUIRED
  BEGIN
    current stock 100000
    delta = 95000 - 100000 = -5000     ("add" mode: delta = input)
    delta 0?  -> return { movement: null }  (nothing written)
    append adjustment -5000 (from Shop floor, note)
    addStockDelta(-5000)
  COMMIT
```

Before and after:

```
           stock_movement rows             item_variant.stock_milli
before     opening +100000                 100000
after      opening +100000                  95000
           adjustment -5000 "Count 22 Nov"
```

The old row is never changed. History stays readable.

### Flow 4: typing a bill (before saving)

```
NewBillScreen
  mount: loadDraftForm() -- a draft exists? --> offer "recover bill"
  type "mc" in search (2+ chars)
     -> call("items.list", {query:"mc", limit:8})  -> dropdown
     -> Enter adds MCB 16A as a DraftLine { qty "1", rate "183.20" }
        (adding the same item again adds 1 to its quantity)
  every change:
     ev = evaluateDraft(form.draft)   (useMemo, pure, in the page)
        -> amounts, totals, line errors shown live
     useDraftAutosave: 300 ms after the last change
        -> call("bills.draft.save", { payload: form })
           BillRepository.saveDraft: DELETE draft_bill; INSERT JSON
```

The `BillForm` carries a `clientBillId` made by `crypto.randomUUID()` when the
bill is started. It is saved in the draft too, so a bill recovered after a
power cut keeps the same id. Flow 5 shows why that matters.

### Flow 5: save a bill (the most important flow)

The cashier presses Ctrl+S on our example bill.

```
NewBillScreen.save
  ev.valid? no --> toast first error, stop
  call("bills.save", { clientBillId:"7c1e...", paymentMode:"cash",
        billDiscountPaise:0,
        lines:[ {wire, 2500, 12050, 125}, {mcb, 3000, 18320, 0} ] })
     |
handlers "bills.save" -> billsSaveInput.parse
     |
BillingService.saveBill(input, now)
  computeBill  -> lineAmounts [30000, 54960], total 84960
  BEGIN TRANSACTION
  | findByClientBillId("7c1e...")
  |   found --> return THAT bill (no new number, no new movement)
  | for each line: item exists? active? quantity fits the unit?
  |   no --> NOT_FOUND / ITEM_INACTIVE / INVALID_QUANTITY (rollback)
  | profile = SettingsRepository.get()
  | billedAt     = now (epoch ms)
  | businessDate = businessDateOf(billedAt, "Asia/Kolkata") "2026-11-22"
  | FY           = "26-27"
  | nextSeq("C1","26-27", template) -> 123
  | number       = "C1/26-27/000123"
  | roundBillTotal(84960, on) -> +40, 85000
  | insertBill   -> bill row + bill_tender (cash, 85000)
  | insertLines  -> 2 bill_line rows (name + unit snapshots)
  | for each line:
  |    append sale movement (-2500 wire, -3000 mcb), doc = bill
  |    addStockDelta(-2500), addStockDelta(-3000)
  | clearDraft()
  | negativeStockItems = lines' items with stock < 0
  COMMIT
  <- { bill, lines, negativeStockItems }
     |
NewBillScreen: setSaved(result); setForm(emptyForm())  (new clientBillId)
  -> shows BillView (print / PDF happen only now, after the commit)
```

What the database holds after the commit:

```
bill            C1/26-27/000123  subtotal 84960  disc 0  round +40
                total 85000  status posted  client_bill_id 7c1e...
bill_tender     cash  85000  label
bill_line  #1   Copper wire 1.5 sq mm  metre  2500 x 12050 -125 = 30000
bill_line  #2   MCB 16A                pcs    3000 x 18320      = 54960
stock_movement  sale  2500  from Shop floor  doc bill/<id>
stock_movement  sale  3000  from Shop floor  doc bill/<id>
number_series   C1 26-27 last_seq 123
draft_bill      (empty)
```

**Idempotency**: the double click, or a crash after commit then retry.

```
click 1 ---> save, commit, bill 000123
click 2 ---> same clientBillId ---> findByClientBillId hit
             ---> returns bill 000123 again; nothing new written
```

Without the key, a double click would make bill 000124 and take the stock
twice. The `UNIQUE (shop_id, client_bill_id)` index backs this up.

**Negative stock does not block a sale.** The shop may sell an item whose
recorded stock is wrong. The sale is saved, stock goes below zero, the item is
returned in `negativeStockItems`, `BillView` shows it, and the Items nav shows
"Needs correction" until someone adjusts it (Flow 3).

### Flow 6: print or save a PDF

```
BillView.print
  call("bills.print", { id, target:"receipt" })
PrintService.print
  BillRepository.get(id) + SettingsRepository.get()  (reads only)
  renderBillHtml(bill, lines, profile, target)  every value escaped
  pageSpec: 80mm roll -> @page 80mm auto; A4/A5 sheet sizes
  electronRenderer.print(html)
     new hidden BrowserWindow (sandbox, javascript:false)
     loadURL("data:text/html,...")
     webContents.print({silent:false})  -> OS print dialog
     destroy window (always, in finally)
  user cancelled -> { printed:false } (not an error)
  printer failed -> PRINT_FAILED
                    "The bill is saved; try again or save a PDF."

BillView.pdf
  call("system.pickPdfPath", { defaultName:"C1-26-27-000123.pdf" })
  call("bills.exportPdf", { id, target, filePath })
     -> printToPDF -> fs.writeFile    (failure: WRITE_FAILED)
```

A print failure **cannot** affect the bill: the bill was committed in Flow 5
and `PrintService` has no write methods.

### Flow 7: backups

```
every 15 min (startBackupTimer)          on quit (before-quit)
        |                                  preventDefault, stop timer
        v                                        |
runBackupQuietly  <------------------------------+
  backup folder set?  no -> skip
  BackupService.run(now)
    target = <folder>/shopos-20261122-143000.sqlite
    sqlite.backup(target)        online backup API, app keeps working
    validateBackupFile(target)   opens, integrity_check, tables present
    backup_log  INSERT ok
    prune: keep newest copy of each of the last 30 days
           + newest 4 of today; delete the rest
  failure: delete partial file, backup_log INSERT failed + error,
           logged; Settings shows "last error"  (never crashes)
then on quit: close sqlite, app.quit()
```

`backup.run` (the "Back up now" button) calls the same `BackupService.run` but
returns the error to the screen. `backup.status` reads `backup_log` for "last
good backup" and "last error".

### Flow 8: restore a backup, keeping bill numbers unique

The PC's disk was replaced. The owner restores last night's backup, which ends
at bill 120. Bills 121 to 126 were printed today.

The restore has two steps: **Check** (read only, shows the plan) and
**Restore** (applies exactly the plan the owner saw).

```
SettingsScreen "Restore from backup" -> useRestoreBackup.start
  call("system.pickBackupFile") -> path -> RestoreBackupDialog opens
  owner types "C1/26-27/000126", presses Check
  call("backup.planRestore", { filePath, lastIssuedBillNo })
     |
handlers "backup.planRestore"            (changes nothing)
  validateBackupFile(path)               bad file -> INVALID_BACKUP
  planRestoreNumbering(path, typed, now)
     copy backup to an OS temp folder, open the COPY
     BackupInspectionRepository: series C1, template, zone
     parseBillNumber(typed) -> FY 26-27, seq 126
        wrong format / other series / future FY -> INVALID_FIELD
     FY before the backup's newest FY            -> INVALID_FIELD
     restoredLastSeq = 120
     planNumberGap(120, 126) -> gap 121..126, next 127
     temp folder deleted (finally)
  <- preview { nextBillNo:"C1/26-27/000127",
               gapRecorded:{ seqFrom:121, seqTo:126,
                             isEstimated:false } }
     |
dialog shows the plan; typing again clears it
owner presses Restore
  call("backup.restore", { filePath, lastIssuedBillNo,
                           confirmedPreview: <the plan shown> })
     |
handlers "backup.restore"
  plan again from the file; differs from confirmedPreview?
     -> INVALID_BACKUP "The backup changed after you checked it."
  shell.scheduleRestore(path, plan)      runs in 200 ms
  <- { restored:true, ...preview }  -> toast, dialog closes
     |
(200 ms later, after the screen got the reply)  shell.restoreAndRelaunch
  isQuitting = true; stop backup timer; close live sqlite
  restoreWithNumbering
     copy backup -> shopos.sqlite.restore-prep-<pid>   (beside the DB)
     assertPlanMatchesCopy: copy still ends at 120?  no -> INVALID_BACKUP
     open + migrate the prepared copy (old backups get upgraded)
     BEGIN
       ensureSeries(C1, 26-27)
       recordGap(121..126, "lost_in_restore", is_estimated 0)
       setLastSeq(126)
     COMMIT; wal_checkpoint(TRUNCATE)
     restoreBackup(prepared -> live)
        validate; copy to .restore-<pid>; delete -wal and -shm;
        rename over shopos.sqlite      (atomic swap)
     delete prepared copy (finally)
  app.relaunch(); app.exit(0)
  failure anywhere -> "Restore failed" box; live DB unchanged;
                      exit(0) WITHOUT relaunch (start the app again)
```

Before and after:

```
                 live DB before     backup file     live DB after
last bill        126                120             120
number_series    last_seq 126       last_seq 120    last_seq 126
bill_number_gap  -                  -               121..126 lost
next bill        127                (121!)          127
```

If the owner leaves the number empty, the plan jumps by 100 and marks it
estimated (`is_estimated = 1`): gap 121..220, next bill 221. That jump only
protects numbers up to 220; if more than 100 bills were lost, numbers could
repeat, so the dialog asks for the last printed number first.

### Flow 9: the database is damaged at start-up

```
openCheckedSqlite -> integrity_check fails -> DATABASE_CORRUPT
handleStartFailure -> offerRestoreForDamagedDatabase
   open-file dialog "Choose a Shop OS backup to restore"
     chosen -> restoreBackup(backup, live) -> relaunch, exit(0)
     cancelled or failed -> error box (points to docs/restore-guide.md)
                            exit(1); the damaged file is left as it is
```

This path has no number-gap step yet: the app cannot ask questions before it
has a window. `docs/restore-guide.md` is the manual for the owner.

### Flow 10: clock and time-zone check

```
App route changes -> useClockWarnings(route)
  deviceTimeZone = Intl...resolvedOptions().timeZone  "Europe/London"
  call("settings.clockCheck", { deviceTimeZone })
SettingsService.clockCheck
  shop zone "Asia/Kolkata"; lastBilledAt = max(bill.billed_at)
  findClockWarnings -> ["TIME_ZONE_DIFFERS"]
ClockWarnings banner shows a warning (word + colour); billing continues
A failed check shows nothing.
```

### Flow 11: change settings

```
SettingsScreen.save -> call("settings.update", profile)
SettingsService.update
  settingsUpdateInput.parse     (lengths, width enum, known time zone)
  validateNumberTemplate("{series}-{fy}-{seq}", "COUNTER1", now, zone)
     worst case "COUNTER1-99-00-999999" = 21 chars > 16
     -> INVALID_FIELD "Number could be 21 characters; the limit is 16"
  ok -> UPDATE shop_profile
```

Settings apply to **future** bills only. A saved bill keeps its own number,
`doc_title` and round-off, so a reprint is identical.

---

## 12. Errors: how a failure travels

```
core / service           handler (toFailure)        renderer
throw CoreError(         { ok:false,                call() throws
  "ITEM_INACTIVE",   -->   code:"ITEM_INACTIVE", -->  ApiError(code, msg)
  "MCB 16A is inactive")   message:"..." }          screen: toast(msg)

throw ZodError       -->  code:"INVALID_FIELD"
throw anything else  -->  code:"INTERNAL" (logged in main;
                          "Nothing was lost; please try again.")
```

Rules of thumb:

- Throw `CoreError` with a code from `errors.ts` and a message a shopkeeper
  can read. It reaches the screen as is.
- A transaction that throws rolls back: "Nothing was lost" is true.
- Warnings (negative stock, clock) are data in the result, not errors.

---

## 13. Testing

```
packages/core/tests/         unit, plain Node, fast       pnpm test
apps/desktop/tests/
|-- unit/                    pure main/preload helpers
|-- integration/             services + repositories +
|                            handlers on in-memory SQLite
|                            + upgrade tests per migration
|-- renderer/ + component    React with jsdom and a fake
|   folders (*.test.tsx)     window.shopos (fakeShopos)
|-- e2e/                     Playwright drives the BUILT app
`-- helpers/                 testDb, fixtures, fakes
```

| Kind | Runs in | Key helper | Example |
|---|---|---|---|
| Core unit | plain Node | none | `money.test.ts`: `2500 x 12050 = 30125` |
| Integration | Electron's Node (`ELECTRON_RUN_AS_NODE=1`) | `createTestDb()`: `:memory:` + all migrations + seed | `billing.test.ts`: save twice with one `clientBillId`, one bill |
| Upgrade | Electron's Node | `upgradeFixture`, `schemaSteps` | `billNumberGapUpgrade.test.ts`: old DB migrates, rows kept |
| Renderer | jsdom | `fakeShopos`, `renderWithTheme` | `statusInScreens.test.tsx` |
| End to end | real Electron | `launch()` with temp `SHOPOS_USER_DATA` | `billing.spec.ts`: type, save, check DB with `sqlite3` CLI |

Test first for anything in core and anything that writes bills, stock or the
ledger (constitution). The skill `shopos-testing` has the details.

The native-module trap: better-sqlite3 has **one** binary, built for
**Electron** (ABI 148). That is why desktop tests run through
`scripts/vitest-electron.mjs`. `npx vitest` uses plain Node and fails with
`NODE_MODULE_VERSION`. Never run `pnpm rebuild better-sqlite3`.

---

## 14. Tooling, CI and commands

| Command | Does |
|---|---|
| `pnpm install` | install; `postinstall` fetches the Electron SQLite binary |
| `pnpm dev` | run the app on `shopos-dev.sqlite` |
| `pnpm test` | core + desktop Vitest |
| `pnpm lint` / `typecheck` / `format` | code checks |
| `pnpm build` then `pnpm test:e2e` | Playwright on the built app |
| `pnpm --filter @shopos/desktop db:generate` | SQL migration from `schema.ts` |
| `pnpm --filter @shopos/desktop package` | installer (electron-builder) |
| `pnpm pr:size` | changed lines of your PR |

CI (`.github/workflows/ci.yml`), report-only for now:

```
quick-checks ------> tests-and-coverage ------> end-to-end
(format, lint,                                    ^
 types, scripts,                                  |
 migrations, PR title) --> build -----------------+
alongside: pr-size (info), dependency-audit, secret-scan (info)
```

Lint limits (warnings): file 200 lines (tests 300), function 40, component 120,
complexity 10, parameters 4, nesting 2. Errors: no single-letter names, no
nested ternaries, no `continue`, layering imports.

---

## 15. How to add a new command

`bills.cancel` is a good real example to read: it was added exactly this way
(see `code-walkthroughs.md` W24). Follow the layers bottom-up, writing tests
first.

```
1 core/types.ts      billsCancelInput (Zod) + BillsCancelInput type
2 core/commands.ts   CommandMap["bills.cancel"] = [input, {bill}]
                     add "bills.cancel" to COMMAND_NAMES
3 repository         BillCancelRepository.markCancelled
                     (trigger allows only posted -> cancelled)
4 service            BillingService.cancelBill: ONE transaction:
                     status + sale_cancel movements + stock
5 handlers.ts        "bills.cancel": cmd(billsCancelInput, ...)
6 preload            nothing: it reads COMMAND_NAMES
7 renderer           call("bills.cancel", ...) from a screen;
                     text in shared/text/strings.ts  (not done yet)
8 contract doc       specs/<feature>/contracts/ipc-commands.md
9 tests              core unit, integration, e2e where it writes data
```

TypeScript helps: once step 2 is done, `createHandlers` fails to compile until
step 5 exists, because `Handlers` must cover every `CommandName`.

Before building anything, check it is in the current feature's spec
(CLAUDE.md, "Working with Spec Kit"). The skills `shopos-electron-ipc`,
`shopos-service-layer` and `shopos-feature-workflow` cover the details.

---

## 16. Not built yet, and traps for the unwary

| Thing | State today |
|---|---|
| Cancel a bill (`bills.cancel`) | command, service and repository done and tested; **no screen** calls it |
| Bill list / search (`bills.list`) | command done; **no screen**, so a saved bill cannot be reopened or reprinted after leaving its view |
| Restore on a damaged DB at start-up | swaps the file only; no number-gap step |
| Import (`importPreviewInput`, `importCommitInput`) | schemas only |
| Tax (GST), HSN, barcode | columns reserved on `item_variant`, unused |
| Encryption (SQLCipher) | hook comment in `connection.ts`, deferred |
| Godowns, transfers | `location.kind` allows `godown`; only "Shop floor" exists |
| `bill_tender.status` | always `label`: the app records the mode, it does not take money |

Traps:

- **Never** write `item_variant.stock_milli` without a matching
  `stock_movement` in the same transaction. Use `addStockDelta` right after
  `StockRepository.append`.
- **Never** add update or delete methods to `StockRepository` or the bill
  tables. The triggers will reject them anyway.
- Do not read the clock inside core. Pass `now` in (services do
  `now: Date = new Date()` as a default parameter, which tests override).
- Use the **shop's** time zone for dates (`profile.timeZone`), never the PC's.
- Do not copy the live `.sqlite` file for a backup; WAL means the file alone
  may be missing recent writes. Use `sqlite.backup()`.
- Repositories must accept a `Handle` and be constructed **inside** the
  transaction callback (`new ItemRepository(tx, ctx)`), or their writes fall
  outside the transaction.
- Entity names differ from column names (`number` vs `bill_no`,
  `itemId` vs `variant_id`). Translate only in repositories.

---

## 17. Why it is built this way

| Decision | Why (project reason) | Trade-off | Practice and source |
|---|---|---|---|
| Electron with a sandboxed, isolated renderer and a narrow preload | the counter PC holds all shop data; a page bug must not reach files or SQL | every data call goes through IPC, more code per command | Electron's own security checklist: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security) (official docs) |
| SQLite in WAL mode, one file, on the PC | the shop must bill with no internet (constitution); one file is easy to back up | one writer at a time; fine for one counter | [SQLite WAL](https://www.sqlite.org/wal.html) (official docs) |
| Online backup API, not file copy | a copy of a WAL database can miss committed writes | needs an open handle | [SQLite backup API](https://www.sqlite.org/backup.html) (official docs) |
| Append-only movements, stock = sum | stock history must explain every unit; no silent edits | a cached `stock_milli` must be kept in step | the general event-log pattern; [M. Fowler, Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) (secondhand summary of a pattern, not a company practice) |
| Integer paise and thousandths | floats cannot hold 0.1; a bill must add up to the paisa | conversions at the edges (`parseRupees`, `formatRupees`) | Stripe's API takes amounts in the smallest currency unit: [Stripe currencies](https://docs.stripe.com/currencies) (vendor docs) |
| Idempotency key on bill save | a double click or retry must not make two bills or take stock twice | one more unique column | Stripe idempotent requests: [Stripe docs](https://docs.stripe.com/api/idempotent_requests) (vendor docs) |
| Business rules in a pure core package | rules can be tested fast with no Electron; the future server can reuse them | one more package, and data mapping in repositories | "ports and adapters" layering; no single company source verified here |
| Rules checked twice (core and SQL `CHECK`/triggers) | a service bug must not save a wrong total | rules written in two places | no reliable company source found; it is the constitution's choice |

---

## 18. Glossary

| Term | Meaning here |
|---|---|
| paise | 1/100 rupee; every money value is an integer number of paise |
| milli (qty) | 1/1000 of the unit; 2.5 metre = 2500 |
| bp | basis points; 12.5% = 1250 |
| series / counter code | the counter's prefix in a bill number, e.g. `C1` |
| FY | Indian financial year, 1 April to 31 March, e.g. `26-27` |
| seq | the running number within one series and FY, e.g. `123` |
| business date | the bill's calendar date in the shop's time zone |
| posted / cancelled | the only two bill states; posted -> cancelled once |
| movement | one row in `stock_movement`; never edited |
| needs correction | an item whose stock is below zero |
| draft | the bill being typed, autosaved for crash recovery |
| clientBillId | the idempotency key made when a bill is started |
| gap | bill numbers lost in a restore, recorded so they are never reused |
| Ctx | `{businessId, shopId, deviceId}` stamped on every row |
| Handle | a Drizzle database or transaction a repository writes through |
| Result | `{ok:true,data}` or `{ok:false,code,message}`: every IPC reply |
| Shell | dialogs and restart, injected into handlers |

---

## 19. Resources to learn

The links are grouped by module, in the same order as this guide. Each one is
labelled: **official** (the project's own docs or spec), **book**,
**vendor** (a company's docs or blog about its own product) or **summary**
(someone else explaining a pattern). Use the official docs when they disagree
with anything else.

### 19.1 Suggested learning path

You don't need to read everything first. Learn each module when you start
working on it:

```
Week 1  TypeScript basics --> Electron process model --> this guide
           |
           v
Week 2  SQLite (WAL, transactions, triggers) --> Drizzle --> Zod
           |
           v
Week 3  React (thinking in React, effects) --> Radix Themes
           |
           v
Week 4  Vitest --> Playwright for Electron --> ship one small task
```

The task to try: add a field to the item form. It touches core, the schema,
a migration, a repository, a service, IPC and a screen, which is one of every
layer.

### 19.2 Inside this repository (read these first)

| What | Where | Teaches you |
|---|---|---|
| Constitution | `.specify/memory/constitution.md` | the rules that override everything |
| Current spec | `specs/001-shop-os-mvp/spec.md` | what we are building now (FR-, US- IDs) |
| IPC contract | `specs/001-shop-os-mvp/contracts/ipc-commands.md` | every command's input, output, errors |
| Data model | `specs/001-shop-os-mvp/data-model.md` | tables and their rules, in prose |
| Research log | `specs/001-shop-os-mvp/research.md` | why each decision (D1, D2, ...) was made |
| Scenarios | `specs/001-shop-os-mvp/quickstart.md` | hands-on walkthroughs to run |
| Coding skills | `.claude/skills/shopos-*/` | the coding standards for each layer |
| Design guidelines | `docs/design/design-guidelines.md` | colours, light/dark mode, counter UX |
| PR guide | `docs/contributing/pull-requests.md` | PR size, titles, template |
| Restore guide | `docs/restore-guide.md` | what the owner does when the DB is lost |
| Long-term design | `docs/reference/architecture.md` | where the product is going |

### 19.3 Language and workspace

| Topic | Resource | Type |
|---|---|---|
| TypeScript | [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) | official |
| Strict mode flags | [TSConfig reference: strict](https://www.typescriptlang.org/tsconfig#strict) | official |
| pnpm workspaces | [pnpm: Workspace](https://pnpm.io/workspaces) | official |
| `BigInt` (used in `money.ts`) | [MDN: BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) | official |
| Safe integers | [MDN: Number.isSafeInteger](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isSafeInteger) | official |
| Time zones (`businessDate.ts`) | [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) | official |

### 19.4 `packages/core`: domain modelling

| Topic | Resource | Type |
|---|---|---|
| Money as integers | [Martin Fowler: Money pattern](https://martinfowler.com/eaaCatalog/money.html) | summary |
| Smallest currency unit | [Stripe: supported currencies (amounts in minor units)](https://docs.stripe.com/currencies) | vendor |
| Pure core, adapters outside | [Alistair Cockburn: Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/) | summary (the pattern's author) |
| Validation schemas | [Zod documentation](https://zod.dev) | official |
| Indian GST (later features) | [GST portal](https://www.gst.gov.in/) | official; tax rules for this app are confirmed by the shop's CA |

### 19.5 Database: SQLite, better-sqlite3, Drizzle

| Topic | Resource | Type |
|---|---|---|
| WAL mode | [SQLite: Write-Ahead Logging](https://www.sqlite.org/wal.html) | official |
| Online backup API | [SQLite: Backup API](https://www.sqlite.org/backup.html) | official |
| Transactions | [SQLite: BEGIN TRANSACTION](https://www.sqlite.org/lang_transaction.html) | official |
| Triggers (immutability) | [SQLite: CREATE TRIGGER](https://www.sqlite.org/lang_createtrigger.html) | official |
| CHECK and UNIQUE | [SQLite: CREATE TABLE](https://www.sqlite.org/lang_createtable.html) | official |
| Foreign keys | [SQLite: Foreign Key Support](https://www.sqlite.org/foreignkeys.html) | official |
| Upsert (`nextSeq`) | [SQLite: UPSERT](https://www.sqlite.org/lang_upsert.html) | official |
| Table rebuilds in migrations | [SQLite: ALTER TABLE, "other kinds of changes"](https://www.sqlite.org/lang_altertable.html) | official |
| `integrity_check`, pragmas | [SQLite: PRAGMA](https://www.sqlite.org/pragma.html) | official |
| better-sqlite3 API | [better-sqlite3 API docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) | official |
| Drizzle overview | [Drizzle ORM docs](https://orm.drizzle.team/docs/overview) | official |
| Drizzle with SQLite | [Drizzle: Get started with SQLite](https://orm.drizzle.team/docs/get-started-sqlite) | official |
| Drizzle migrations | [Drizzle: Migrations](https://orm.drizzle.team/docs/migrations) | official |
| Drizzle transactions | [Drizzle: Transactions](https://orm.drizzle.team/docs/transactions) | official |
| UUID v7 ids | [RFC 9562: UUIDs](https://www.rfc-editor.org/rfc/rfc9562) | official (IETF) |

### 19.6 Repositories and services

| Topic | Resource | Type |
|---|---|---|
| Repository | [Martin Fowler: Repository](https://martinfowler.com/eaaCatalog/repository.html) | summary |
| Service layer | [Martin Fowler: Service Layer](https://martinfowler.com/eaaCatalog/serviceLayer.html) | summary |
| One transaction per use case | [Martin Fowler: Unit of Work](https://martinfowler.com/eaaCatalog/unitOfWork.html) | summary |
| Append-only history | [Martin Fowler: Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) | summary |
| Idempotency keys | [Stripe: Idempotent requests](https://docs.stripe.com/api/idempotent_requests) | vendor |
| Idempotency, in depth | [Stripe blog: Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency) | vendor blog |

### 19.7 Electron: main, preload, IPC, security

| Topic | Resource | Type |
|---|---|---|
| Main vs renderer | [Electron: Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) | official |
| IPC (`invoke`/`handle`) | [Electron: Inter-Process Communication](https://www.electronjs.org/docs/latest/tutorial/ipc) | official |
| Preload bridge | [Electron: Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) | official |
| Sandbox | [Electron: Process Sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox) | official |
| Security checklist | [Electron: Security](https://www.electronjs.org/docs/latest/tutorial/security) | official |
| Performance | [Electron: Performance](https://www.electronjs.org/docs/latest/tutorial/performance) | official |
| Printing and PDF | [Electron: webContents (`print`, `printToPDF`)](https://www.electronjs.org/docs/latest/api/web-contents) | official |
| Content-Security-Policy | [MDN: Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy) | official |
| Build tooling | [electron-vite guide](https://electron-vite.org/guide/) | official |
| Installer | [electron-builder](https://www.electron.build/) | official |

### 19.8 Renderer: React and Radix

| Topic | Resource | Type |
|---|---|---|
| React basics | [React: Learn](https://react.dev/learn) | official |
| Splitting screens into components | [React: Thinking in React](https://react.dev/learn/thinking-in-react) | official |
| Pure components | [React: Keeping Components Pure](https://react.dev/learn/keeping-components-pure) | official |
| Effects (search, autosave) | [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) | official |
| Custom hooks (`useItems`) | [React: Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) | official |
| Radix Themes | [Radix Themes: Getting started](https://www.radix-ui.com/themes/docs/overview/getting-started) | official |
| Light and dark mode | [Radix Themes: Dark mode](https://www.radix-ui.com/themes/docs/theme/dark-mode) | official |
| Radix Primitives | [Radix Primitives: Introduction](https://www.radix-ui.com/primitives/docs/overview/introduction) | official |
| Accessibility basics | [W3C: WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) | official |

### 19.9 Testing

| Topic | Resource | Type |
|---|---|---|
| Vitest | [Vitest guide](https://vitest.dev/guide/) | official |
| Component tests | [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) | official |
| Electron end-to-end | [Playwright: Electron](https://playwright.dev/docs/api/class-electron) | official |
| Why and how to test | [Software Engineering at Google, ch. 11: Testing Overview](https://abseil.io/resources/swe-book/html/ch11.html) | book (free online) |
| Unit tests | [Software Engineering at Google, ch. 12: Unit Testing](https://abseil.io/resources/swe-book/html/ch12.html) | book |
| Test doubles (our fakes) | [Software Engineering at Google, ch. 13: Test Doubles](https://abseil.io/resources/swe-book/html/ch13.html) | book |

### 19.10 Process: specs, reviews, CI

| Topic | Resource | Type |
|---|---|---|
| Spec Kit (our workflow) | [github/spec-kit](https://github.com/github/spec-kit) | official |
| Code review | [Google Engineering Practices: code review](https://google.github.io/eng-practices/) | official (Google) |
| Small changes | [Google: Small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html) | official (Google) |
| Code review culture | [Software Engineering at Google, ch. 9: Code Review](https://abseil.io/resources/swe-book/html/ch09.html) | book |
| PR title format `type(scope)` | [Conventional Commits](https://www.conventionalcommits.org/) | official |
| CI workflows | [GitHub Actions documentation](https://docs.github.com/en/actions) | official |
| Securing CI | [GitHub: Security hardening for GitHub Actions](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions) | official |

---

### Where to go next

1. `.specify/memory/constitution.md`: the rules.
2. `specs/001-shop-os-mvp/spec.md` and `contracts/ipc-commands.md`.
3. Run `pnpm dev`, add an item, save a bill, then open
   `userData/shopos-dev.sqlite` with `sqlite3` and find the rows from Flow 5.
4. Read `BillingService.saveBill` with Flow 5 beside it.
5. `docs/reference/architecture.md` for where the product is going.
