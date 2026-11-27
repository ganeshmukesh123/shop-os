# Shop OS: Code Walkthroughs, Click to Database (for new joiners)

This document follows every use case **through the code**: from the button
the user presses, through each function in order, to the SQLite row or the
printer, and back to what the screen shows. For each one it lists **every
case**: the normal path, the user cancelling, bad input, and each error the
code can raise.

Read `architecture-walkthrough.md` first for the layers and modules. This
document assumes you know what a service and a repository are.

**Version.** Written against commit `f336366` (branch
`test/renderer-inventory-and-app-shell`, 22 November 2026). Line numbers
drift as code changes; if a line has moved, search for the function name.

**Path shorthand** used everywhere below:

| Short | Full path |
|---|---|
| `core/` | `packages/core/src/` |
| `main/` | `apps/desktop/src/main/` |
| `preload/` | `apps/desktop/src/preload/` |
| `ui/` | `apps/desktop/src/renderer/` |

**Layer tags** in the step lists:

```
[UI]   React, in the sandboxed page        [IPC]  the bridge and handler
[SVC]  service in the main process         [REPO] repository / SQL
[CORE] pure rule in @shopos/core           [OS]   Electron / OS / disk
```

The worked example, as in the main guide:

```
Bill C1/26-27/000123
1  Copper wire 1.5 sq mm  2.5 metre x ₹120.50 - ₹1.25 = ₹300.00
2  MCB 16A                3 pcs     x ₹183.20         = ₹549.60
   Lines ₹849.60   round off +₹0.40   Grand total ₹850.00   Cash
```

---

## Contents

| # | Use case | Screen |
|---|---|---|
| [W0](#w0-the-ipc-hop-every-command-takes-it) | The IPC hop (every command takes it) | all |
| [W1](#w1-start-the-app) | Start the app | none |
| [W2](#w2-switch-screens) | Switch screens | nav |
| [W3](#w3-list-search-and-filter-items) | List, search and filter items | Items |
| [W4](#w4-add-an-item) | Add an item | Items |
| [W5](#w5-edit-an-item) | Edit an item | Items |
| [W6](#w6-deactivate-or-reactivate-an-item) | Deactivate or reactivate an item | Items |
| [W7](#w7-adjust-stock) | Adjust stock | Items |
| [W8](#w8-find-an-item-and-add-it-to-the-bill) | Find an item and add it to the bill | New bill |
| [W9](#w9-change-lines-discounts-customer-payment-clear) | Change lines, discounts, customer, payment; clear | New bill |
| [W10](#w10-draft-autosave) | Draft autosave | New bill |
| [W11](#w11-recover-a-bill-after-a-crash) | Recover a bill after a crash | New bill |
| [W12](#w12-save-the-bill) | **Save the bill** | New bill |
| [W13](#w13-print-the-bill) | **Print the bill** | Saved bill |
| [W14](#w14-save-the-bill-as-a-pdf) | Save the bill as a PDF | Saved bill |
| [W15](#w15-start-the-next-bill) | Start the next bill | Saved bill |
| [W16](#w16-load-and-save-settings) | Load and save settings | Settings |
| [W17](#w17-choose-the-backup-folder) | Choose the backup folder | Settings |
| [W18](#w18-back-up-now) | Back up now | Settings |
| [W19](#w19-automatic-backup-and-backup-on-quit) | Automatic backup, and backup on quit | none |
| [W20](#w20-restore-a-backup) | **Restore a backup** | Settings |
| [W21](#w21-the-database-is-damaged-at-start-up) | The database is damaged at start-up | none |
| [W22](#w22-clock-and-time-zone-warnings) | Clock and time-zone warnings | all |
| [W23](#w23-change-the-theme) | Change the theme | Settings |
| [W24](#w24-list-bills-and-cancel-a-bill-commands-only) | List bills, cancel a bill (commands only) | none yet |
| [W25](#w25-the-page-tries-to-leave-open-a-window-or-ask-for-a-permission) | The page tries to leave, open a window or ask for a permission | none |

---

## W0. The IPC hop (every command takes it)

Every walkthrough below says "→ IPC `name`". This is what happens in that
arrow, every time. Example: `call("bills.print", { id, target: "receipt" })`.

```
[UI]  ui/shared/api/api.ts:15        call(name, input)
        |  :19  fn = window.shopos[name]
        v
[IPC] preload/bridge.ts               buildShopOsApi: one function per
        |                             COMMAND_NAMES entry
        |  ipcRenderer.invoke("shopos:invoke", name, input ?? {})
        v
[IPC] main/ipc/index.ts:39            ipcMain.handle(CHANNEL, ...)
        |  :40  isTrustedSender(summarizeSender(event), trustedUrls)
        |         no  -> log scheme+host only (:21)
        |                return {ok:false, INTERNAL, "Command refused"}
        |  :45  name in COMMAND_NAMES?
        |         no  -> {ok:false, INTERNAL, "Unknown command"}
        |  :48  handlers[name](input)
        v
[IPC] main/ipc/handlers.ts:85         cmd(schema, run)
        |  :87  input = schema.parse(raw)       (Zod)
        |  :88  data  = await run(input)        (the service)
        |  :90  catch -> toFailure (:58)
        v
      Result {ok:true, data} | {ok:false, code, message, details?}
        |
        v
[UI]  ui/shared/api/api.ts:27         ok   -> return data
                                :28   else -> throw ApiError(code, msg)
```

The sender check (`main/ipc/senderPolicy/senderPolicy.ts:24`) accepts a
command only from the **main frame** showing a **trusted page**: the app's
own `index.html`, or the Vite dev server in `pnpm dev`. The address is parsed
and compared by scheme, host and path, never by text prefix. The trusted list
comes from `main/app/appConfig.ts:56` (`listTrustedPageUrls`).

**Cases that apply to every command** (not repeated below):

| Case | Where | What the caller gets |
|---|---|---|
| Sent from an iframe or another page | `ipc/index.ts:40` | `INTERNAL` "Command refused"; main logs `Refused a command from an untrusted sender: https://evil.example` |
| Name not in the contract | `ipc/index.ts:45` | `INTERNAL` "Unknown command" |
| Input fails the Zod schema | `handlers.ts:87` → `toFailure` | `INVALID_FIELD`, every Zod message joined by `; ` |
| Service throws `CoreError` | `toFailure` | that `code`, `message`, `details` |
| Anything else throws (SQLite, a bug) | `toFailure` | `INTERNAL` "Something went wrong. Nothing was lost; please try again."; full error in the main log |

`call` never returns a failure: it **throws** `ApiError`. So every screen
wraps calls in `try/catch` (or `.catch`) and usually shows a toast.

---

## W1. Start the app

**Trigger:** the shopkeeper double-clicks Shop OS.

### Main process

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | OS | `main/index.ts` | `applyUserDataOverride` (tests set `SHOPOS_USER_DATA`), then `startApp(realElectron, readAppConfig(...))` |
| 2 | SVC | `main/app/appConfig.ts:34` | Works out paths: `userData/shopos.sqlite` (packaged) or `shopos-dev.sqlite` (dev) |
| 3 | OS | `main/app/startApp.ts:94` | `registerQuitHooks` first (W19), then `app.whenReady()` |
| 4 | REPO | `startApp.ts:65` `openShopDatabase` | `mkdir` the data folder |
| 5 | REPO | `main/db/startupSafety.ts:41` `openCheckedSqlite` | Opens the file, runs `PRAGMA integrity_check`; not `ok` → `DATABASE_CORRUPT` (W21). Then WAL + foreign keys |
| 6 | REPO | `startupSafety.ts:86` `needsPreMigrationBackup` | True when the file has tables **and** the newest migration in `drizzle/meta/_journal.json` is newer than the newest row in `__drizzle_migrations` |
| 7 | REPO | `startupSafety.ts:109` `backupBeforeMigrating` | If 6 is true: `sqlite.backup()` to `pre-migration-backups/shopos-pre-migrate-YYYYMMDD-HHMMSS.sqlite`, keep newest 5 |
| 8 | REPO | `main/db/connection.ts:36` `migrateConnection` | Foreign keys off, Drizzle migrations in one transaction, `foreign_key_check` before COMMIT (`migrateValidated.ts:33`), foreign keys on |
| 9 | REPO | `main/db/seed.ts:17` `ensureSeed` | First run: profile row + "Shop floor" location in one transaction. Returns `Ctx` |
| 10 | SVC | `startApp.ts:47` `buildServices` | `InventoryService`, `BillingService`, `SettingsService`, `PrintService`, `BackupService` |
| 11 | OS | `main/app/securityHeaders.ts:13` | Content-Security-Policy on every response |
| 12 | OS | `main/app/permissionPolicy/permissionPolicy.ts` | Every permission request (camera, microphone, notifications...) answered **no** |
| 13 | IPC | `main/ipc/index.ts:31` `registerIpc` | Registers the one channel with the trusted page list |
| 14 | OS | `main/app/mainWindow.ts:33` `createMainWindow` | Sandboxed, isolated window; deny `window.open`; check `will-navigate` and `will-redirect`; load `index.html` |
| 15 | SVC | `main/app/backupLifecycle.ts:23` | Backup timer, every 15 minutes (W19) |

### Renderer (the page loads)

| # | Tag | Code | What happens |
|---|---|---|---|
| 16 | UI | `ui/app/main.tsx` | `<ThemeProvider><ToastProvider><App/>` |
| 17 | UI | `ui/shared/theme/useThemeController` | Reads the saved theme from `localStorage` on the first render (W23) |
| 18 | UI | `ui/app/App/App.tsx:15` | Route starts at `"bill"`, so `NewBillScreen` mounts |
| 19 | UI | `App.tsx:17` → `useClockWarnings` | IPC `settings.clockCheck` (W22) |
| 20 | UI | `App.tsx:34` | IPC `items.list {needsCorrection:true, limit:1}` → `total` → "N Needs correction" badge on Items |
| 21 | UI | `NewBillScreen.tsx:41` `loadDraftForm` | IPC `bills.draft.load` → recovery dialog if a draft has lines (W11) |
| 22 | UI | `RoundOffLine/useRoundedTotal.ts:13` | IPC `settings.get` → is rounding on? |
| 23 | UI | `NewBillScreen.tsx:49` | When ready, focus moves to the search box |

```
startApp
  whenReady -> open+check DB -> pre-migration copy? -> migrate -> seed
            -> services -> CSP -> permissions -> IPC -> window -> timer
window loads
  App: clockCheck, negatives     NewBill: draft.load, settings.get
```

### All cases

| Case | What happens | User sees |
|---|---|---|
| Normal start | as above | New bill screen, cursor in search |
| First ever start | step 9 seeds "My Shop", series C1 | empty New bill screen |
| New version with a pending migration | step 7 copies the DB, then migrates | nothing extra |
| A migration fails | Drizzle rolls back; `handleStartFailure` (`startApp.ts:77`) | error box "Shop OS could not start", app exits (code 1); DB unchanged, copy exists |
| DB damaged | step 5 throws `DATABASE_CORRUPT` | W21 |
| Any other start error (disk not writable) | `handleStartFailure` | error box, exit 1 |
| macOS: last window closed, dock icon clicked | `activate` handler (`startApp.ts`) | a new window |

---

## W2. Switch screens

**Trigger:** click **Items / New bill / Settings**, or press Ctrl/Cmd + 1, 2, 3.

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `ui/app/App/App.tsx:57` | Button `onClick` → `setRoute(route)` |
| 1b | UI | `App.tsx:20-32` | Or: `keydown` with Ctrl/Cmd and `1`/`2`/`3` → `preventDefault`, `setRoute` |
| 2 | UI | `App.tsx:77-79` | The old screen **unmounts**, the new one mounts with fresh state |
| 3 | UI | `App.tsx:34` | Effect on `[route]`: IPC `items.list` to refresh the negatives badge |
| 4 | UI | `App.tsx:17` | `useClockWarnings(route)` runs the clock check again (W22) |

| Case | What happens |
|---|---|
| Leave New bill with lines typed | The screen unmounts; the draft was already autosaved (W10). Come back → recovery dialog (W11) |
| Leave the saved-bill view | The saved bill is forgotten; coming back shows an empty New bill screen. Reprinting an old bill needs a bill list screen (not built, W24) |
| Badge query fails | `.catch(() => {})`: badge keeps its last value |
| Another key with Ctrl (Ctrl+S) | Not in the map; App ignores it (New bill handles Ctrl+S, W12) |

---

## W3. List, search and filter items

**Trigger:** open Items; type in "Search items by name"; tick "Show inactive"
or "Needs correction".

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `ui/features/inventory/ItemsScreen/ItemsScreen.tsx:15-18` | `query`, `includeInactive`, `needsCorrection` in state → `useItems(filter)` |
| 2 | UI | `inventory/hooks/useItems/useItems.ts:12` | Effect on any filter change or `tick`: IPC `items.list {query, includeInactive, needsCorrection, limit:200, offset:0}` |
| 3 | IPC | `main/ipc/handlers.ts:104` | Zod `itemsListInput` (query ≤120, limit 1..1000) |
| 4 | SVC | `main/services/InventoryService.ts:107` | `listItems` |
| 5 | REPO | `main/repositories/ItemRepository.ts:162` `list` | Builds `WHERE`: active only unless asked; `stock_milli < 0` for needs-correction; `LIKE %term%` with `%`/`_` escaped, `COLLATE NOCASE` |
| 6 | REPO | same | `count(*)` for `total`, then rows ordered: names **starting** with the term first, then A to Z; `limit 200` |
| 7 | REPO | `ItemRepository.ts:15` `toItem` | Row → `Item`, `needsCorrection = stockMilli < 0` |
| 8 | UI | `useItems.ts:22` | Only if this is still the latest request (`live`): set `items`, `total` |
| 9 | UI | `ItemsScreen.tsx:83-112` | Table: name, unit, ₹ price, stock, "Negative stock: needs correction" / "Inactive" badges |

Example: typing `mcb` returns "MCB 16A", "MCB 32A" (start with "mcb") before
"Havells MCB box" (contains it).

| Case | What happens | User sees |
|---|---|---|
| Typing fast | One request per keystroke; older answers ignored by the `live` flag | only the latest results |
| No items at all | `items.length === 0`, no filter | "No items yet. Add your first item." |
| No match | same, with a query or filter | "No items match." |
| More than 200 matches | only the first 200 rows; `total` is the true count | "350 items", 200 rows |
| Typed `%` or `_` | escaped, matched literally | items containing `%` |
| Request fails | `useItems` has `.finally` but no `.catch`: the rejection is unhandled and the old list stays | old list, no message (known gap) |

---

## W4. Add an item

**Trigger:** Items → **Add item**, fill the form, **Save** (or Enter in any field).

Example: "Copper wire 1.5 sq mm", unit metre, ₹120.50, opening 100.

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `ItemsScreen.tsx:35` | `setForm({})` → `<ItemForm item={undefined}>` opens |
| 2 | UI | `ItemForm/useItemFormFields/useItemFormFields.ts:7` | Field state. Choosing a unit resets the decimal choice (`:20`), so "Allow decimals" defaults from the unit: metre/kg/litre yes, pcs/box no (`core/quantity.ts` `defaultAllowsDecimal`) |
| 3 | UI | `ItemForm.tsx:84` or `:26-31` | Save click, or Enter inside an `<input>` → `save()` |
| 4 | UI | `ItemForm/useItemFormSave/useItemFormSave.ts:43` | `isSaveRunning` ref: a second Enter in the same moment is ignored |
| 5 | UI | `useItemFormSave.ts:55` → `validateItemForm.ts:18` | Checks in the page: name, unit, unit ≤20, price (`parseRupees`), opening (`parseQuantity`), whole number for non-decimal units |
| 6 | UI | `useItemFormSave.ts:71` | Any error → show the list, stop |
| 7 | UI | `useItemFormSave.ts:20` `sendItem` | No `item` → IPC `items.create {name, unit, allowsDecimal, pricePaise:12050, openingQtyMilli:100000}` |
| 8 | IPC | `handlers.ts:107` | Zod `itemsCreateInput` (trimmed name 1..120, unit 1..20, price ≥0, opening ≥0) |
| 9 | SVC | `InventoryService.ts:26` `createItem` | `allowsDecimal` (given or default); `assertQuantity(opening, allowsDecimal)` |
| 10 | SVC | same, `db.transaction` | **BEGIN** |
| 11 | REPO | `ItemRepository.ts:139` `findActiveByName` | Active item with the same name, any case → `DUPLICATE_NAME` with the matches as `details` |
| 12 | REPO | `ItemRepository.ts:75` `create` | `INSERT item_family`; `INSERT item_variant` with code from `nextItemCode` (`:61`, e.g. `ITM-0001`), stock 0 |
| 13 | REPO | `StockRepository.ts:49` `append` | Opening ≠ 0: `INSERT stock_movement` (`opening`, qty 100000, `to` = Shop floor) |
| 14 | REPO | `ItemRepository.ts:154` `addStockDelta` | `UPDATE item_variant SET stock_milli = stock_milli + 100000` |
| 15 | SVC | same | **COMMIT**, return `{item}` |
| 16 | UI | `useItemFormSave.ts:75-76` | Toast "Copper wire 1.5 sq mm saved"; `onDone` → close dialog, `reload()` the list (W3) |

| Case | Where | User sees |
|---|---|---|
| Name empty | `validateItemForm.ts:20` | "Name is required" (no call made) |
| Unit missing / custom unit too long | `:21-23` | the unit message |
| Price "12.345" or "abc" | `:24-25` | price message |
| Opening "2.5" for pcs | `:27` | "whole numbers only" |
| Same name as an active item ("mcb 16a") | `findActiveByName` → `DUPLICATE_NAME` | "An item with this name already exists" + the list of existing items; save blocked until renamed |
| Same name as an **inactive** item | allowed | saved |
| Opening 0 or blank | step 13 skipped | item with stock 0, no movement |
| Double Enter | ref blocks the second | one item |
| Any SQL error | transaction rolls back | the error text; no half item |
| Cancel / Esc / click outside | `onOpenChange(false)` → `onClose` | dialog closes, nothing saved |

---

## W5. Edit an item

**Trigger:** Items → **Edit** on a row → change → **Save**.

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `ItemsScreen.tsx:95` | `setForm({item})` → form filled from the item; opening field hidden |
| 2 | UI | `useItemFormSave.ts:22-24` | IPC `items.update {id, name, unit, pricePaise}` (no stock, no decimal flag) |
| 3 | IPC | `handlers.ts:110` | Zod `itemsUpdateInput` |
| 4 | SVC | `InventoryService.ts:54` `updateItem` | **BEGIN**; `items.get(id)` → `NOT_FOUND` |
| 5 | SVC | same | Will be active and name changed → duplicate check excluding itself → `DUPLICATE_NAME` |
| 6 | SVC | same | Unit changed **and** current stock is whole → `allowsDecimal` reset to the new unit's default |
| 7 | REPO | `ItemRepository.ts:112` `update` | `UPDATE item_variant` with only the given fields; renames the family too |
| 8 | SVC | | **COMMIT** → toast, close, reload |

| Case | What happens |
|---|---|
| Rename "MCB 16A" → "MCB 16A Havells" | Item renamed. **Old bills keep "MCB 16A"**: bill lines store a name snapshot |
| Price ₹183.20 → ₹190.00 | Only new bills use it; saved bills keep their rate |
| Unit pcs → box with stock 7 | `allowsDecimal` reset to box default (no) |
| Unit pcs → metre with stock 2.5 | stock not whole, so `allowsDecimal` is left as it was |
| Stock change wanted | Not here: the form says to use "Adjust stock" (W7) |
| Item deleted meanwhile | `NOT_FOUND` "Item not found" |

---

## W6. Deactivate or reactivate an item

**Trigger:** Items → **Deactivate** (or **Reactivate**).

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `ItemsScreen.tsx:105` → `:22` `toggleActive` | IPC `items.update {id, active: !active}` |
| 2 | SVC | `InventoryService.ts:54` | Reactivating (`active:true`) runs the duplicate-name check |
| 3 | REPO | `ItemRepository.ts:112` | `UPDATE item_variant SET is_active = 0/1` |
| 4 | UI | `ItemsScreen.tsx:25` | `reload()`; the row disappears unless "Show inactive" is ticked |

| Case | What happens |
|---|---|
| Deactivate | Hidden from bill search (W8), stock and history kept. Never deleted |
| Reactivate while another active item has the name | `DUPLICATE_NAME` → error toast |
| A recovered draft still holds a now-inactive item | Save refuses with `ITEM_INACTIVE` (W12) |
| Any failure | `toast("error", message)` (`:27`) |

---

## W7. Adjust stock

**Trigger:** Items → **Adjust stock** → choose **Add/remove** or **Set to** →
quantity → note → **Save**.

Example: counted 95 m of wire, stock says 100 m: **Set to** 95, note
"Count 22 Nov".

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `ItemsScreen.tsx:98` | `setAdjusting(item)` → `<AdjustStockDialog>` |
| 2 | UI | `AdjustStockDialog.tsx:25` `save` (button `:100` or Enter `:76`) | A leading `-` is allowed only in "add" mode (`:27`); `parseQuantity` (`core/quantity.ts`) |
| 3 | UI | `:29-30` | Bad quantity → "Enter a quantity, for example 5 or 2.5"; empty note → "A note is required" |
| 4 | UI | `:33` | IPC `stock.adjust {itemId, mode:"set", quantityMilli:95000, note}` |
| 5 | IPC | `handlers.ts:113` | Zod `stockAdjustInput` (note ≤200) |
| 6 | SVC | `InventoryService.ts:81` `adjustStock` | Blank note → `NOTE_REQUIRED`. **BEGIN** |
| 7 | SVC | same | `items.get` → `NOT_FOUND`; `assertQuantity` → `INVALID_QUANTITY` for decimals on pcs; set below 0 → `INVALID_QUANTITY` |
| 8 | SVC | same | `delta = add ? qty : qty - current` = 95000 - 100000 = **-5000** |
| 9 | SVC | same | `delta === 0` → return `{movement:null}`, nothing written |
| 10 | REPO | `StockRepository.ts:49` | `INSERT stock_movement` (`adjustment`, 5000, `from` Shop floor, note) |
| 11 | REPO | `ItemRepository.ts:154` | `stock_milli + (-5000)` |
| 12 | SVC | | **COMMIT** |
| 13 | UI | `AdjustStockDialog.tsx:39-40` | Toast "Copper wire 1.5 sq mm: stock updated", close, reload |

```
mode  typed   current   delta     movement written
add   "5"     100       +5000     adjustment, to Shop floor
add   "-5"    100       -5000     adjustment, from Shop floor
set   "95"    100       -5000     adjustment, from Shop floor
set   "100"   100       0         none (still "stock updated")
set   "-5"    -         -         UI: "Enter a quantity..."
```

| Case | User sees |
|---|---|
| "2.5" on a pcs item | "this unit accepts whole numbers only" (from main, shown in the dialog) |
| Fixing negative stock after a sale (W12) | Set to the counted amount; the badge clears on the next screen switch |
| Error | Shown inside the dialog (`:42`), dialog stays open |

---

## W8. Find an item and add it to the bill

**Trigger:** New bill → type in the search box → arrow keys → Enter (or click).

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `billing/NewBillScreen/components/BillSearchBox/BillSearchBox.tsx:39` | `onQueryChange` → `useItemSearch` `setQuery` |
| 2 | UI | `NewBillScreen/hooks/useItemSearch/useItemSearch.ts:13` | Fewer than 2 characters → no call, no list |
| 3 | UI | `useItemSearch.ts:19` | IPC `items.list {query, limit:8, offset:0}` (active items only) → W3 steps 3-7 |
| 4 | UI | `useItemSearch.ts:21` | Latest answer only; highlight reset to the first row |
| 5 | UI | `BillSearchBox.tsx:53-79` | Each match: name, (unit), "₹183.20 · stock 10" and "(negative)" when below zero |
| 6 | UI | `BillSearchBox.tsx:15-28` | ↓/↑ move the highlight; **Enter** chooses it; **Esc** clears |
| 7 | UI | `:58` | Mouse: `onMouseDown` + `preventDefault` (focus stays in the search box) |
| 8 | UI | `NewBillScreen.tsx:53` | `addItemAndClearSearch` → `addItem` + `clearSearch` |
| 9 | UI | `useBillForm/useBillForm.ts:31` `addItemToForm` | Item already on the bill → its quantity +1 (`"2"` → `"3"`). New → `buildLine` (`:11`): qty "1", rate from the item price, no discount |
| 10 | UI | `useQuantityFocus.ts:12,25` | Remembers the line; after render focuses and selects its quantity, so typing "3" replaces "1" |
| 11 | UI | `BillLineRow.tsx:39` | Enter in quantity → focus back to search for the next item |
| 12 | UI | `useBillForm.ts:59` | `evaluateDraft` re-runs (W9); autosave starts (W10) |

| Case | What happens |
|---|---|
| "m" (1 character) | nothing |
| "zz" no match | "No matching items" |
| Item inactive | not in results |
| Same MCB added twice | one line, qty 2 |
| Enter with no match | ignored |
| Search call fails | `.catch(() => {})`: list stays as it was |

---

## W9. Change lines, discounts, customer, payment; clear

**Trigger:** type in a line's Qty / Rate / Discount, toggle ₹/%, Remove; type
bill discount, customer name, choose payment; **Clear**.

Every change follows the same path:

```
field onChange
  -> useBillForm patchLine / updateDraft / updateForm / removeLine
     (useBillForm.ts:61-91, immutable copy of the form)
  -> evaluation = useMemo(evaluateDraft(form.draft))   useBillForm.ts:59
       core/draftBill.ts  evaluateDraft: never throws
  -> BillLineRow: amount or "–" + error text   BillLineRow.tsx:78,93
  -> BillSummaryPanel: totals, errors, Save    BillSummaryPanel.tsx
  -> useRoundedTotal: round off for display    useRoundedTotal.ts:24
  -> useDraftAutosave (W10)
```

How `evaluateDraft` reads each line (`core/draftBill.ts`):

| Typed | Result |
|---|---|
| qty "2.5", unit metre | 2500 milli |
| qty "2.5", unit pcs | "This unit accepts whole numbers only" |
| qty "0" or "" | "Quantity must be more than 0" |
| rate "120.50" | 12050 paise; "abc" → "Enter the rate in rupees" |
| disc "1.25" ₹ | 125 paise; more than the line → "Discount cannot be more than the line amount" |
| disc "10" % | 10% of the line, half up (`percentOfPaise`) |
| disc "150" % | "Discount % must be 0 to 100" |
| bill disc "900" ₹ on ₹849.60 | "Bill discount cannot be more than the total" |
| no lines | "Add at least one item" |

| Control | Code | Effect |
|---|---|---|
| Customer name | `BillSummaryPanel.tsx:28` | `updateForm({customerName})`, max 80 |
| Payment | `:39` | `cash / upi / card / unpaid` label only |
| Bill discount + ₹/% | `:65-83` | `updateDraft` |
| Remove | `BillLineRow.tsx:82` → `removeLine` | line gone |
| **Clear** | `BillSummaryPanel.tsx:102` → `resetForm` (`useBillForm.ts:96`) | new empty form **with a new `clientBillId`**; disabled when already empty |
| Save button | `:111` | `disabled` while `evaluation.valid` is false |

Display rounding: `useRoundedTotal` reads `settings.get` **once when the screen
mounts**. If rounding is on, ₹849.60 shows "Round off +₹0.40, Grand total
₹850.00". A negative unfinished total is not rounded. If settings change, the
display updates the next time the New bill screen mounts. Main recomputes
the rounding on save anyway (W12).

Summary errors drop the two generic messages starting "Fix" and "Add", since
each line shows its own error.

---

## W10. Draft autosave

**Trigger:** any change to the bill form.

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `NewBillScreen.tsx:47` | Enabled only when `ready && !saved && !recover` |
| 2 | UI | `billing/hooks/useDraftAutosave/useDraftAutosave.ts:10` | The first run after mounting is skipped (an empty form must not wipe a saved draft) |
| 3 | UI | `:14-17` | Debounce 300 ms: every change restarts the timer |
| 4 | UI | `:15` | IPC `bills.draft.save {payload: form}`; empty form (`billForm.ts:11`) → `payload: null` |
| 5 | IPC | `handlers.ts:121` | Zod `draftSaveInput` (any JSON) |
| 6 | REPO | `BillRepository.ts:183` `saveDraft` | `DELETE draft_bill`; `INSERT` the JSON (one row at most) |

| Case | What happens |
|---|---|
| Typing "183.20" quickly | one save, 300 ms after the last key |
| Recovery dialog open | autosave off, so the old draft is not overwritten before the cashier chooses |
| After save | off (saved view); main already cleared the draft in the save transaction |
| Save fails | `.catch(() => {})` silently; next change tries again |
| `draft_bill` is not a financial record | it may be deleted and replaced, unlike bills |

---

## W11. Recover a bill after a crash

**Trigger:** the power went off with 2 lines typed; the app starts again.

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `NewBillScreen.tsx:41` → `billForm.ts:14` `loadDraftForm` | IPC `bills.draft.load` → `BillRepository.ts:191` reads the JSON |
| 2 | UI | `billForm.ts:17-23` | No payload, no `draft`, `lines` not an array or empty → `null` (no dialog) |
| 3 | UI | `billForm.ts:24` | Merge onto `emptyForm()` so missing fields get defaults |
| 4 | UI | `NewBillScreen.tsx:106` → `RecoverDraftDialog.tsx` | "The app closed before the last bill was saved. Continue that bill?" with "2 lines: Copper wire 1.5 sq mm, MCB 16A" |
| 5a | UI | **Continue** → `NewBillScreen.tsx:113` | `replaceForm` with the draft, **keeping its `clientBillId`** |
| 5b | UI | **Discard** → `:109` | IPC `bills.draft.save {payload:null}`; empty form |

| Case | What happens |
|---|---|
| Draft from an older version, odd shape | step 2/3 guards; worst case no dialog |
| `bills.draft.load` fails | `.catch`, screen still becomes ready |
| Continue, but an item was deactivated since | Save → `ITEM_INACTIVE` "MCB 16A is inactive" (W12) |
| Continue, but prices changed | the draft keeps the typed rate; the cashier may edit it |

---

## W12. Save the bill

**Trigger:** **Save bill (Ctrl+S)** button, or Ctrl/Cmd+S anywhere on the New
bill screen.

### Renderer

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `BillSummaryPanel.tsx:111` or `useBillSave/useBillSave.ts:28-40` | Click, or `keydown` Ctrl/Cmd+S (`preventDefault` stops the browser's "save page") |
| 2 | UI | `useBillSave.ts:57` | `evaluation.valid === false` → toast first error ("Fix the highlighted lines") and stop |
| 3 | UI | `:62` | `input === null` or `isSaveRunning` (ref, set at once) → return silently |
| 4 | UI | `:66-67` | Lock, `isSaving` → button spinner |
| 5 | UI | `:10` `buildSaveInput` | `{clientBillId, customerName?, paymentMode, billDiscountPaise, lines:[{itemId, quantityMilli, ratePaise, lineDiscountPaise}]}`; the page's totals are **not** sent |
| 6 | IPC | `:69` → W0 → `handlers.ts:131` | Zod `billsSaveInput` (`clientBillId` must be a UUID) |

### Main process

| # | Tag | Code | What happens |
|---|---|---|---|
| 7 | SVC | `main/services/BillingService.ts:37` `saveBill` | Parse again; no lines → `EMPTY_BILL` |
| 8 | CORE | `:44` → `core/billing.ts` `computeBill` | Line amounts [30000, 54960], total 84960; bad discount → `INVALID_DISCOUNT` |
| 9 | SVC | `:46` | **BEGIN** (every repository built on `tx`) |
| 10 | REPO | `:54` → `BillRepository.ts:151` `findByClientBillId` | Already saved with this id → return **that** bill (no new number, no stock change) |
| 11 | REPO | `:65-72` | For each line: `items.get` → `NOT_FOUND`; inactive → `ITEM_INACTIVE`; `assertQuantity` → `INVALID_QUANTITY` |
| 12 | CORE | `:75-77` | `billedAt = now`; `businessDateOf(billedAt, shop zone)` = "2026-11-22"; FY "26-27" |
| 13 | REPO | `:78` → `BillRepository.ts:67` `nextSeq` | `INSERT … ON CONFLICT DO UPDATE last_seq = last_seq + 1 RETURNING` → 123 |
| 14 | CORE | `:83` `formatBillNumber` | "C1/26-27/000123"; seq above 999999 → `INVALID_FIELD` |
| 15 | CORE | `:91` `roundBillTotal` | +40 → 85000 (0 when the setting is off) |
| 16 | REPO | `:93` → `BillRepository.ts:89` `insertBill` | `INSERT bill` (status posted, doc title, **time zone**) + `INSERT bill_tender` (cash, 85000, label). CHECK `total = subtotal - discount + round_off` |
| 17 | REPO | `:111` → `BillRepository.ts:127` `insertLines` | 2 × `INSERT bill_line` with name/unit snapshots |
| 18 | REPO | `:124-132` | Per line: `StockRepository.append` (`sale`, `from` Shop floor, `doc_id` = bill) + `ItemRepository.addStockDelta(-qty)` |
| 19 | REPO | `:133` → `BillRepository.ts:196` | `DELETE draft_bill` |
| 20 | SVC | `:135` | Items on this bill now below zero |
| 21 | SVC | `:140` | **COMMIT**; return `{bill, lines, negativeStockItems}` |

### Back in the renderer

| # | Tag | Code | What happens |
|---|---|---|---|
| 22 | UI | `useBillSave.ts:69-70` | `setSaved(result)`; `onSaved` = `resetForm` (new `clientBillId`) |
| 23 | UI | `NewBillScreen.tsx:61` | `saved` → render `<BillView>` (W13-W15); autosave off |

```
UI evaluate --valid--> call bills.save --> Zod --> computeBill
   BEGIN
     same clientBillId? --yes--> return first bill ------------+
     items ok? --no--> throw --> ROLLBACK --> toast            |
     date, FY --> nextSeq 123 --> number --> round off         |
     bill + tender --> lines --> sale movements + stock        |
     clear draft --> negatives                                 |
   COMMIT                                                      |
UI <------------------- {bill, lines, negativeStockItems} <----+
   BillView (print allowed only now)
```

### All cases

| Case | Where | User sees |
|---|---|---|
| A line has an error, Ctrl+S | `useBillSave.ts:57` | toast "Error: Fix the highlighted lines" |
| Button while invalid | disabled | nothing |
| Ctrl+S twice quickly | ref lock (step 3) | one save |
| Same request reaches main twice (retry) | step 10 | the same bill 000123, stock taken once |
| Item deactivated since it was added | step 11 | toast "MCB 16A is inactive"; nothing saved, number not used |
| Item unit changed to pcs, line qty 2.5 | step 11 | "this unit accepts whole numbers only" |
| Discount larger than line (changed meanwhile) | step 8 | `INVALID_DISCOUNT` message |
| Sale takes stock below zero | step 20 | **saved**; BillView warns "Stock is now below zero for: MCB 16A (-1 pcs). Correct stock from the Items screen."; Items badge (W2) |
| 1 April 00:30 IST | step 12 | first bill of "27-28": `C1/27-28/000001` |
| PC set to London time | step 12 | date and FY still from the shop's zone (W22 warns) |
| Rounding off in Settings | step 15 | round off 0, total ₹849.60 |
| Any DB error (CHECK, disk) | ROLLBACK | `INTERNAL` toast; no bill, no number used, stock unchanged |
| Process killed after COMMIT, before the reply | draft was cleared in the transaction | next start: no recovery dialog; the bill is in the DB |

---

## W13. Print the bill

**Trigger:** after saving, on the saved-bill view: pick **Print to:**
Receipt / A5 / A4, press **Print** (it has focus, so Enter works too).

### Renderer

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `billing/BillView/BillView.tsx:32` | `target` state, default `"receipt"` |
| 2 | UI | `:132-142` | Radix `Select` → `setTarget("a4")` etc. |
| 3 | UI | `:143` | Print button (`autoFocus`, spinner while `busy === "print"`) → `print()` |
| 4 | UI | `:35-38` | `setBusy("print")`; IPC `bills.print {id: bill.id, target}` |

### Main process

| # | Tag | Code | What happens |
|---|---|---|---|
| 5 | IPC | W0 → `handlers.ts:143` | Zod `billsPrintInput`: `id` non-empty, `target` ∈ receipt/a4/a5 |
| 6 | SVC | `main/services/PrintService.ts:34` `print` | Calls `this.html(id, target)` |
| 7 | REPO | `PrintService.ts:24` → `BillRepository.ts:170` `get` | Bill + lines + tender mode; missing → `NOT_FOUND` "Bill not found" |
| 8 | REPO | → `BillRepository.ts:14` `toBill` | `billDate = localIsoOf(billed_at, bill.time_zone)`: shown in the zone **the bill was saved in** |
| 9 | REPO | → `SettingsRepository.ts:14` | Shop name, address, phone, footer, receipt width (current values) |
| 10 | SVC | → `main/services/billHtml.ts:55` `renderBillHtml` | Full HTML page; every text value through `esc()`; no tax words |
| 11 | SVC | → `billHtml.ts:35` `pageSpec` | receipt: `@page {size: 80mm auto}` (58 mm when the shop's paper is 58 mm, otherwise 80); a4/a5: sheet size |
| 12 | OS | `PrintService.ts:37` → `main/services/electronRenderer.ts:42` `print` | |
| 13 | OS | `electronRenderer.ts:25` `withWindow` | New hidden `BrowserWindow` (`:9`: `show:false`, sandbox, isolation, no Node, **`javascript:false`**) |
| 14 | OS | same | `loadURL("data:text/html;charset=utf-8," + encoded HTML)` |
| 15 | OS | `:42-52` | `webContents.print({silent:false, printBackground:true}, callback)` → the **operating system print dialog** |
| 16 | OS | callback | `(success, reason)` |
| 17 | OS | `withWindow` `finally` | `destroy()` the hidden window, **always** |
| 18 | SVC | `PrintService.ts:38-40` | Interpret the result (table below) |

### Back in the renderer

| # | Tag | Code | What happens |
|---|---|---|---|
| 19 | UI | `BillView.tsx:39-43` | On error: toast message, plus "The bill is saved. You can try again or save a PDF." unless the code is already `PRINT_FAILED` |
| 20 | UI | `:44-45` | `finally` → `busy = null` |

```
BillView  Print
  |  call bills.print {id, target}
  v
handler -> Zod -> PrintService.print
                    html(): BillRepository.get  (NOT_FOUND?)
                            SettingsRepository.get
                            renderBillHtml + pageSpec
                    electronRenderer.print(html)
                      hidden window (no JS) <- data: URL
                      webContents.print -> OS dialog
                         printed  -> {printed:true}
                         cancel   -> {printed:false}
                         failed   -> PRINT_FAILED
                      finally destroy window
  <- Result
BillView: error? toast : nothing        busy off
```

What the receipt says (from `renderBillHtml`, 80 mm):

```
                Estimate
                My Shop
         12 MG Road, Jaipur
             98290 00000
Bill No: C1/26-27/000123
Date: 22/11/2026 14:30
Payment: Cash
# Item                    Qty     Rate          Amount
1 Copper wire 1.5 sq mm   2.5 metre ₹120.50 -₹1.25 ₹300.00
2 MCB 16A                 3 pcs   ₹183.20       ₹549.60
Total                                          ₹849.60
Round off                                       +₹0.40
Grand Total                                    ₹850.00
               Thank you
```

### All cases

| Case | `print` callback | Service result | User sees |
|---|---|---|---|
| Printed | `success: true` | `{printed:true}` | the paper; no toast |
| Cancelled in the OS dialog | `false`, `"cancelled"` | `{printed:false}` | nothing (cancelling is not an error) |
| Printer offline / job failed | `false`, `"failed"` | throws `PRINT_FAILED` "Printing failed: failed. The bill is saved; try again or save a PDF." | that toast |
| Hidden window fails to load | throws | `PRINT_FAILED` | same toast |
| Bill id unknown | before printing | `NOT_FOUND` | "Bill not found The bill is saved. You can try again or save a PDF." |
| Cancelled bill reprinted | | prints with a boxed **CANCELLED** and the reason | |
| Item renamed since | | the line prints the **snapshot** name | identical reprint |
| Shop renamed since | | header uses the **current** shop name | |
| Shop's time zone changed since | | date shown in the bill's **stored** zone | same date as the first print |
| Item name contains `<b>` | `esc()` | printed as text, not HTML | |
| Print twice | | two print jobs; the database is never touched | |

**Why a print failure can never damage the bill:** the bill was committed in
W12 before this screen existed, and `PrintService` has no write methods.

---

## W14. Save the bill as a PDF

**Trigger:** saved-bill view → choose paper → **Save PDF**.

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `BillView.tsx:146` → `:49` `pdf()` | `setBusy("pdf")` |
| 2 | UI | `:52-54` | IPC `system.pickPdfPath {defaultName:"C1-26-27-000123.pdf"}` (`/` and `\` become `-`) |
| 3 | IPC | `handlers.ts:190` | Pass-through schema (no Zod); `shell.pickPdfPath` |
| 4 | OS | `main/app/shell.ts:68` | `dialog.showSaveDialog(focused window, {defaultPath, filters: PDF})` |
| 5 | UI | `BillView.tsx:55` | `path === null` (cancelled) → `return` (the `finally` still clears busy) |
| 6 | UI | `:56` | IPC `bills.exportPdf {id, target, filePath}` |
| 7 | IPC | `handlers.ts:148` | Zod `billsExportPdfInput` |
| 8 | SVC | `PrintService.ts:49` `exportPdf` | `html(id, target)` (W13 steps 7-11) |
| 9 | OS | `electronRenderer.ts:54` `toPdf` | Hidden window; `printToPDF`: receipt page width = 80 mm ÷ 25.4 in, height 11.7 in; A4/A5 by name |
| 10 | OS | `PrintService.ts` | `fs.writeFile(filePath, pdf)` |
| 11 | UI | `BillView.tsx:57` | Toast "PDF saved: /Users/…/C1-26-27-000123.pdf" |

| Case | User sees |
|---|---|
| Cancel the save dialog | nothing |
| Folder not writable / disk full / file open in another app | `WRITE_FAILED` "Could not create the PDF: EACCES…" |
| Bill not found | `NOT_FOUND` "Bill not found" |
| Existing file chosen | the OS dialog asks to replace it; then overwritten |

---

## W15. Start the next bill

**Trigger:** saved-bill view → **New bill**.

| # | Code | What happens |
|---|---|---|
| 1 | `BillView.tsx:149` → `onNew` = `useBillSave.ts:81` `startNewBill` | `setSaved(null)` |
| 2 | `NewBillScreen.tsx:61` | Renders the empty form (already reset with a new `clientBillId` in W12 step 22) |
| 3 | `NewBillScreen.tsx:49-51` | Focus back to the search box; autosave enabled again |

There is no way back to the saved bill from here yet (no bill list screen, W24).

---

## W16. Load and save settings

**Trigger:** open Settings; edit; **Save settings**.

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `features/settings/SettingsScreen/SettingsScreen.tsx:44-50` | `refresh`: IPC `settings.get` then `backup.status` |
| 2 | REPO | `SettingsService.ts:22` → `SettingsRepository.ts:14` | The one `shop_profile` row → `ShopProfile` |
| 3 | UI | `:51` | Until loaded: "Loading…" |
| 4 | UI | `:63` `set(patch)` | Every edit changes local state only |
| 5 | CORE | `:57` `validateNumberTemplate` | Live preview on every render: "Preview: **C1/26-27/000001**" or the reason |
| 6 | UI | `BillSettingsFields.tsx` | Document title (1..30), round total switch, time zone (live "unknown zone" error), paper 58mm/80mm/A4/A5 |
| 7 | UI | `:173-177` | Save disabled unless template ok, name not blank, `isBillSettingsValid` (title + zone) |
| 8 | UI | `:65` `save` | IPC `settings.update` (whole profile) |
| 9 | IPC | `handlers.ts:159` | Zod `settingsUpdateInput` (lengths, paper enum, `isValidTimeZone`) |
| 10 | SVC | `SettingsService.ts:26` `update` | `validateNumberTemplate` again → `INVALID_FIELD` with the reason |
| 11 | REPO | `SettingsRepository.ts:36` | `UPDATE shop_profile` |
| 12 | UI | `:67-69` | Show saved values; toast "Settings saved"; refresh backup status |

| Series | Template | Worst case | Result |
|---|---|---|---|
| `C1` | `{series}/{fy}/{seq}` | `C1/99-00/999999` (15) | ok |
| `COUNTER1` | `{series}-{fy}-{seq}` | `COUNTER1-99-00-999999` (21) | "Number could be 21 characters; the limit is 16" |
| `C1` | `{series}/{fy}` | no `{seq}` | "Template must contain {seq}" |
| `C 1` | `{series}/{fy}/{seq}` | has a space | "Series may use letters, digits, - and / only" |

| Case | User sees |
|---|---|
| Load fails | error toast; stays on "Loading…" |
| Zone "Asia/Kolkatta" (typo) | field error; Save disabled |
| Saved: rounding switched off | **future** bills only; the New bill display follows on its next mount (W9) |
| Saved: doc title "Tax Invoice" | future bills print it; old bills keep "Estimate" (stored per bill) |
| Saved: series C2 | next bill starts the `C2` series at 000001 |
| Server rejects | error toast; screen keeps the typed values |

---

## W17. Choose the backup folder

**Trigger:** Settings → **Choose** next to Backup folder.

| # | Code | What happens |
|---|---|---|
| 1 | `SettingsScreen.tsx:195` → `:75` `chooseFolder` | IPC `system.pickFolder` |
| 2 | `main/app/shell.ts:55` | `dialog.showOpenDialog({openDirectory, createDirectory})` |
| 3 | `SettingsScreen.tsx:77` | Cancelled → `null` → nothing |
| 4 | `:78-80` | Folder chosen → `save({...profile, backupFolder})` → W16 steps 8-12 **immediately** |

Note: step 4 saves the **whole** profile, so any other unsaved edits on the
screen are saved at the same time. If one of them is invalid, the folder is
not saved either and an error toast explains why.

---

## W18. Back up now

**Trigger:** Settings → **Back up now** (disabled until a folder is chosen).

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `SettingsScreen.tsx:212-219` → `:84` `runNow` | busy; IPC `backup.run` |
| 2 | SVC | `main/services/BackupService.ts:87` `run` | Folder blank → error "No backup folder is set" |
| 3 | OS | same | `target = <folder>/shopos-20261122-143000.sqlite`; `mkdir` |
| 4 | OS | same | `sqlite.backup(target)`: SQLite **online backup API**; billing can carry on |
| 5 | SVC | `BackupService.ts:19` `validateBackupFile` | Opens the copy read-only: `integrity_check`, required tables |
| 6 | REPO | `BackupLogRepository.ts:24` | `INSERT backup_log` status ok |
| 7 | OS | `BackupService.ts:120` `prune` | Keep the newest file of each of the last 30 days + newest 4 of today; delete the rest |
| 8 | UI | `SettingsScreen.tsx:88` | Toast "Backup complete" |
| 9 | UI | `:93` `finally` | Refresh status: "Last backup: 22/11/2026, 14:30:00" |

| Case | What happens | User sees |
|---|---|---|
| Folder on a removed USB drive | `mkdir`/`backup` throws | partial file deleted; log row "failed"; `BACKUP_FAILED` toast; red "Backup failed" message with the reason |
| Copy fails the check | step 5 throws | same as above |
| Logging the failure fails too | swallowed | the **original** error is still reported |
| 40 old backups in the folder | step 7 | 30 days + 4 of today remain |
| Files not named `shopos-YYYYMMDD-HHMMSS.sqlite` | ignored by prune | never deleted |

---

## W19. Automatic backup, and backup on quit

**Trigger:** every 15 minutes; and when the shopkeeper closes the app.

```
startBackupTimer (backupLifecycle.ts:23)      every 15 min
        |
        v
runBackupQuietly (backupLifecycle.ts:6)
  folder set?  no  -> skip
               yes -> BackupService.run  (W18 steps 2-7)
  error -> console.error "Backup failed (shown in Settings)"
           (never thrown; Settings shows lastError)

close window -> window-all-closed -> app.quit()
             -> before-quit (backupLifecycle.ts:32)
                  isQuitting or no BackupService? -> let it quit
                  else: isQuitting = true; preventDefault;
                        stop timer; runBackupQuietly
                        finally: close SQLite; app.quit()
                  (second before-quit sees isQuitting -> quits)
```

| Case | What happens |
|---|---|
| No folder chosen | no backup; nothing logged |
| Backup fails at quit | logged; the app still closes |
| Quit during a restore | `isQuitting` already true (W20); no backup taken |

---

## W20. Restore a backup

**Trigger:** Settings → **Restore from backup** → choose file → type the last
bill number you printed → **Check** → read the plan → **Restore**.

Example: the backup ends at bill 120; bills up to `C1/26-27/000126` were
printed today.

### Part A: open the dialog

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `SettingsScreen.tsx:220` → `RestoreBackupDialog/useRestoreBackup.ts:45` `start` | IPC `system.pickBackupFile` → `shell.ts:61` open dialog filtered to `.sqlite` |
| 2 | UI | `:48-50` | Cancelled → nothing. Chosen → `pendingFile` set → dialog opens (`isOpen`) |
| 3 | UI | `RestoreBackupDialog.tsx` | Shows the file name, a warning, the field "Last bill number printed" with placeholder `C1/26-27/000126` (`restoreMessages.ts:19`) |

### Part B: Check (read only; nothing is changed)

| # | Tag | Code | What happens |
|---|---|---|---|
| 4 | UI | `useRestoreBackup.ts:57` | Typing bumps `numberVersion` and **forgets any plan** (Restore disabled again) |
| 5 | UI | `:78` `check` → `:64` `runStep` | busy; IPC `backup.planRestore {filePath, lastIssuedBillNo?}` (blank → field left out) |
| 6 | IPC | `handlers.ts:169` | Zod `backupPlanRestoreInput` |
| 7 | SVC | `main/ipc/restoreCommands.ts:9` `planRestoreFor` | |
| 8 | SVC | → `BackupService.ts:19` `validateBackupFile` | Not SQLite, damaged, or missing tables → `INVALID_BACKUP` |
| 9 | SVC | → `RestoreNumbering.ts:99` `planRestoreNumbering` | |
| 10 | OS | → `backupCopy.ts:23` `withBackupCopy` | Async copy to a new OS temp folder; open the **copy**; temp folder deleted in `finally` |
| 11 | REPO | `BackupInspectionRepository.ts:23` | Series C1, template, zone (older backups: default zone) |
| 12 | CORE | `RestoreNumbering.ts:52` | Current FY in the backup's zone: "26-27" |
| 13 | SVC | `:61` `chooseSeries` | Blank → current FY, `confirmedSeq null`. Typed → `core/numberGap.ts` `parseBillNumber` → `{C1, 26-27, 126}`; wrong format, other series, or future FY → `INVALID_FIELD` |
| 14 | CORE | `:110-115` → `assertNotBeforeBackupYear` | Typed FY earlier than the backup's newest FY → `INVALID_FIELD` |
| 15 | REPO | `:116` `lastSeq` | Backup's last number in that series: 120 |
| 16 | CORE | `:117` `planNumberGap(120, 126)` | gap 121..126, `isEstimated:false` |
| 17 | SVC | `:120-135` | Next number in the **current** FY: `C1/26-27/000127` |
| 18 | SVC | `restoreCommands.ts:18` `toRestorePreview` | `{nextBillNo, gapRecorded:{121,126,false}}` |
| 19 | UI | `useRestoreBackup.ts:83-85` | If the typed number did not change meanwhile → keep the plan |
| 20 | UI | `restoreMessages.ts:43` | "The next bill will be C1/26-27/000127. Bill numbers 121 to 126 will be recorded as lost in the restore." Restore button enabled |

### Part C: Restore

| # | Tag | Code | What happens |
|---|---|---|---|
| 21 | UI | `useRestoreBackup.ts:89` | IPC `backup.restore {filePath, lastIssuedBillNo, confirmedPreview: <the plan shown>}` |
| 22 | IPC | `handlers.ts:174` | Zod `backupRestoreInput` |
| 23 | SVC | `:178` | `planRestoreFor` **again** (never trusts the page's plan) |
| 24 | SVC | `restoreCommands.ts:46` `assertPlanIsConfirmed` | New plan ≠ shown plan → `INVALID_BACKUP` "The backup changed after you checked it. Check the restore again." |
| 25 | OS | `shell.ts:75` `scheduleRestore` | Runs in 200 ms, so the reply reaches the page first |
| 26 | UI | `useRestoreBackup.ts:96-97` | Toast "Restoring… the app will restart. The next bill will be C1/26-27/000127. Bill numbers 121 to 126 are recorded as lost in the restore."; close dialog |
| 27 | OS | `shell.ts:26` `restoreAndRelaunch` | `isQuitting = true`; stop backup timer; **close the live SQLite** |
| 28 | SVC | `RestoreNumbering.ts:183` `restoreWithNumbering` | Validate again; copy backup → `shopos.sqlite.restore-prep-<pid>` beside the DB |
| 29 | SVC | `:38` `assertPlanMatchesCopy` | Copy still ends at 120? Else `INVALID_BACKUP` |
| 30 | REPO | `:141` `applyNumbering` | Open + **migrate** the prepared copy (old backups upgraded); **BEGIN**; `ensureSeries` (`NumberGapRepository.ts:26`), `recordGap` 121..126 with `is_estimated` (`:52`), `setLastSeq(126)` (`:68`); **COMMIT**; `wal_checkpoint(TRUNCATE)` |
| 31 | OS | `BackupService.ts:53` `restoreBackup` | Copy prepared → `shopos.sqlite.restore-<pid>`; delete `-wal`, `-shm`; **rename** over `shopos.sqlite`. On error remove the copy |
| 32 | OS | `RestoreNumbering.ts:197` `finally` | Delete the prepared copy and its `-wal`/`-shm` |
| 33 | OS | `shell.ts:43,47` | `app.relaunch()`; `app.exit(0)` → the app restarts on the restored data (W1) |

```
Check:   pick file -> planRestore (temp copy, read, plan) -> show
Restore: restore + shown plan -> plan again == shown? -> schedule
         200 ms: close DB -> prepared copy -> same as planned?
                 -> migrate copy -> gap + counter (1 tx)
                 -> atomic rename over live DB -> relaunch
         any failure: "Restore failed" box, live DB untouched, exit
```

Before and after:

```
                 live DB before   backup file   live DB after
last bill        126              120           120
number_series    last_seq 126     120           126
bill_number_gap  -                -             121..126 lost
next bill        127              (121!)        127
```

### All cases

| Case | Where | User sees |
|---|---|---|
| Cancel the file picker | step 2 | nothing |
| Not a Shop OS file / damaged | step 8 | red message "This is not a valid Shop OS backup (…)" in the dialog |
| Leave the number blank | step 13 | plan: next 221, "Bill numbers 121 to 220 … That is a block of 100, because the last number was not entered." |
| Typed `C1-26-27-126` (wrong format) | step 13 | "That is not a bill number in this shop's format. It looks like C1/26-27/000126." |
| Typed `C2/26-27/000126` | step 13 | "That bill number is in series C2, but this shop's series is C1." |
| Typed `C1/27-28/000005` in 26-27 | step 13 | "…27-28, which has not started yet…" |
| Typed `C1/25-26/000300`, backup has 26-27 bills | step 14 | "…before this backup's last bill in 26-27…" |
| Typed `C1/26-27/000110`, backup ends at 120 | step 16 | "That number is older than the last number in this backup…" |
| Typed exactly 120 | step 16 | plan: next 121, no lost numbers |
| Typed `C1/25-26/000400` in May, backup ended at 380 in 25-26 | steps 16-17 | gap 381..400 in 25-26; next bill is the 26-27 counter + 1 |
| Number changed while Check runs | step 19 | old answer ignored |
| Number changed after Check | step 4 | plan cleared; Restore disabled until Check again |
| File replaced on disk after Check | step 24 | "The backup changed after you checked it. Check the restore again." |
| File replaced in the 200 ms gap | step 29 | "Restore failed" error box; live DB unchanged; app exits **without** restarting (start it again) |
| Disk full during steps 28-31 | `finally` cleanup | "Restore failed"; live DB unchanged; app exits |
| Close the dialog while busy | `RestoreBackupDialog.tsx:37` | ignored until the step finishes |
| Backup from before feature 0014 | step 30 migrates it | restored and upgraded |

---

## W21. The database is damaged at start-up

**Trigger:** the PC lost power mid-write; `shopos.sqlite` fails its check.

| # | Code | What happens |
|---|---|---|
| 1 | `startupSafety.ts:41` | `integrity_check` not `ok` → close, throw `DATABASE_CORRUPT` |
| 2 | `startApp.ts:77` `handleStartFailure` | Code is `DATABASE_CORRUPT` → `offerRestoreForDamagedDatabase` |
| 3 | `main/app/startupRecovery.ts:16` | Native dialog "Choose a Shop OS backup to restore" (no window exists yet) |
| 4 | `startupRecovery.ts:35` | Chosen → `restoreBackup(file, live)` (`BackupService.ts:53`) → relaunch, exit 0 |

| Case | User sees |
|---|---|
| Valid backup chosen | the app restarts on it |
| Cancelled | "Shop OS database is damaged: … Start Shop OS again and choose a backup, or follow docs/restore-guide.md."; exit 1; damaged file left untouched |
| Chosen file invalid | "Restore failed", then the damaged-database box; exit 1 |

This path does **not** ask for the last bill number (no window to ask in), so
it records no gap. After it, use W20 again if bills were printed after that
backup, or follow `docs/restore-guide.md`.

---

## W22. Clock and time-zone warnings

**Trigger:** app start and every screen switch.

| # | Tag | Code | What happens |
|---|---|---|---|
| 1 | UI | `ui/app/ClockWarnings/useClockWarnings.ts` | `deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone` |
| 2 | UI | same | IPC `settings.clockCheck {deviceTimeZone}` |
| 3 | SVC | `SettingsService.ts:42` | Shop zone from the profile; `BillClockRepository.ts:14` `max(bill.billed_at)` |
| 4 | CORE | `core/clockCheck.ts` `findClockWarnings` | Offsets differ now → `TIME_ZONE_DIFFERS`; now < last bill → `CLOCK_BEFORE_LAST_BILL` |
| 5 | UI | `ClockWarnings.tsx:11` | One warning `StatusMessage` per warning, above every screen |

| Case | User sees |
|---|---|
| PC zone Asia/Calcutta, shop Asia/Kolkata | nothing (same offset) |
| PC zone Europe/London | time-zone warning; bills still dated in the shop's zone |
| PC clock set to last week | clock-went-back warning; billing allowed |
| Check fails | nothing (never blocks billing) |
| Fixed the PC clock | warning clears on the next screen switch |

---

## W23. Change the theme

**Trigger:** Settings → Appearance → **System / Light / Dark**.

| # | Code | What happens |
|---|---|---|
| 1 | `ui/shared/theme/ThemePicker/ThemePicker.tsx:18` | `onChange("dark")` |
| 2 | `useThemeController` `setPreference` | State + `writeStoredPreference` (`themePreference.ts:28`) to `localStorage` |
| 3 | `themePreference.ts:9` `resolveAppearance` | System → light or dark from `useSystemDarkMode` (`matchMedia`) |
| 4 | `ThemeProvider` | Radix `<Theme appearance>` re-renders every screen |

| Case | What happens |
|---|---|
| System, OS switches to dark at sunset | follows at once |
| Storage blocked | choice applies now, not remembered (`:32-36`) |
| Garbage in storage | System (`readStoredPreference`) |
| Printing | always light: bills are separate HTML (W13) |

No IPC: the theme is a per-PC display preference, not shop data.

---

## W24. List bills and cancel a bill (commands only)

The commands exist and are tested, but **no screen calls them yet**. A new
joiner building the bill list will start from here.

### `bills.list`

| # | Code | What happens |
|---|---|---|
| 1 | `handlers.ts:134` | Zod `billsListInput`: number ≤40, customer ≤80, `from`/`to` real dates `YYYY-MM-DD`, status, limit 1..500 |
| 2 | `BillingService.ts:186` | → `BillSearchRepository.ts:64` `list` |
| 3 | `BillSearchRepository.ts:28` | This shop; `bill_no LIKE` / `customer_name LIKE` (escaped, any case); `business_date` between from/to; status |
| 4 | same | `count(*)` total; rows newest first (`billed_at`, `created_at`, `id`); page size capped at 500 |
| 5 | `:48` `tenderModes` | Payment modes for the page in **one** query |

Example: `{number:"0001", from:"2026-11-01", to:"2026-11-30", limit:50, offset:0}`
→ November bills whose number contains "0001", newest first.

### `bills.cancel`

| # | Code | What happens |
|---|---|---|
| 1 | `handlers.ts:140` | Zod `billsCancelInput` (reason ≤200) |
| 2 | `BillingService.ts:154` `cancelBill` | Blank reason → `REASON_REQUIRED` "Say why the bill is being cancelled". **BEGIN** |
| 3 | `:161` | `bills.get` → `NOT_FOUND` |
| 4 | `BillCancelRepository.ts:17` `markCancelled` | `UPDATE bill SET status='cancelled', reason, cancelled_at WHERE id AND shop AND status='posted' RETURNING` (the trigger allows exactly this change) |
| 5 | `BillingService.ts:168` | No row updated → `ALREADY_CANCELLED` |
| 6 | `:172-180` | Per line: `sale_cancel` movement **into** Shop floor + `addStockDelta(+qty)` |
| 7 | | **COMMIT** → `{bill}` with status cancelled |

```
                 before cancel          after cancel
bill             posted                 cancelled, "customer returned"
stock_movement   sale  -2500 wire       sale        -2500 (unchanged)
                                        sale_cancel +2500 (new)
wire stock       97.5 m                 100 m
number 000123    used                   still used, never reissued
```

---

## W25. The page tries to leave, open a window, or ask for a permission

These are security guards (`main/app/`). They matter if a bug or a pasted
link ever puts foreign content in the page.

| Attempt | Guard | Result |
|---|---|---|
| `window.open("https://…")` | `mainWindow.ts` `setWindowOpenHandler` | denied |
| Link or script navigates to `https://evil.example` | `will-navigate` → `navigationPolicy.ts` `isNavigationAllowed` | `preventDefault`; page stays |
| Allowed page redirects elsewhere | `will-redirect`, same check | blocked |
| `file:///etc/passwd` | path must equal the app's `index.html` | blocked |
| `getUserMedia` (camera) | `permissionPolicy.ts` | refused (allow-list is empty) |
| A command from an iframe | `senderPolicy.ts` (W0) | "Command refused" |
| Inline `<script>` injected | CSP `script-src 'self'` (`securityHeaders.ts`) | not run |
| `fetch("https://…")` | CSP `connect-src 'none'` | blocked |
