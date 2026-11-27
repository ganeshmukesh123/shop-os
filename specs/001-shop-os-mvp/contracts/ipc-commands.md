# Contract: Renderer to main-process commands

The UI (renderer) never touches the database. It calls these typed commands through the preload bridge. Every command returns `{ ok: true, data }` or `{ ok: false, code, message }`. Money is integer paise and quantity is integer thousandths on the wire. Validation uses the same Zod schemas in `@shopos/core` on both sides.

| Command | Input | Result | Error codes |
|---|---|---|---|
| `items.list` | `{ query?, includeInactive?, needsCorrection?, limit, offset }` | `{ items[], total }` | |
| `items.create` | `{ name, unit, allowsDecimal?, pricePaise, openingQtyMilli }` | `{ item }` | `DUPLICATE_NAME` (returns the matching items), `INVALID_QUANTITY` |
| `items.update` | `{ id, name?, unit?, pricePaise?, active? }` | `{ item }` | `DUPLICATE_NAME`, `NOT_FOUND` |
| `stock.adjust` | `{ itemId, mode: "add" or "set", quantityMilli, note }` | `{ item, movement }` | `INVALID_QUANTITY`, `NOTE_REQUIRED` |
| `bills.draft.save` | `{ payload }` | `{}` | |
| `bills.draft.load` | `{}` | `{ payload or null }` | |
| `bills.save` | `{ clientBillId, customerName?, paymentMode, billDiscountPaise, lines[{ itemId, quantityMilli, ratePaise, lineDiscountPaise }] }` | `{ bill, negativeStockItems[] }` | `EMPTY_BILL`, `INVALID_QUANTITY`, `INVALID_DISCOUNT`, `ITEM_INACTIVE` |
| `bills.list` | `{ number?, from?, to?, customer?, status?, limit, offset }` | `{ bills[], total }` | `INVALID_FIELD`. Newest first; `number` is part of the bill number (up to 40 characters), `customer` part of the name (up to 80), both ignoring case and matching `%`, `_` and `\` as plain characters; `from` and `to` are business dates `YYYY-MM-DD`, both ends included, either optional; `status` is `posted` or `cancelled` (T076; it was `saved`); `limit` 1 to 500; `total` counts every match, not only the page |
| `bills.get` | `{ id }` | `{ bill, lines[] }` | `NOT_FOUND` |
| `bills.cancel` | `{ id, reason }` | `{ bill }` | `REASON_REQUIRED` (empty or only spaces), `ALREADY_CANCELLED`, `NOT_FOUND`, `INVALID_FIELD` (reason over 200 characters; a limit chosen in T069, not in the spec) |
| `bills.gaps` | `{}` | `{ gaps[] }`, each `{ id, fromNumber, toNumber, seqFrom, seqTo, isEstimated, recordedAt }` | None. Read only (T084, FR-013b). The bill numbers a restore lost, newest record first, written in the series' own number format (`C1/26-27/000121`); `isEstimated` is true for a guessed block of 100; `recordedAt` is an ISO timestamp. Planned: the bill list will show each as "Lost in restore" once the screen part of T084 lands |
| `bills.print` | `{ id, target: "receipt" or "a4" or "a5" }` | `{ printed }` | `PRINT_FAILED` (bill is unaffected) |
| `bills.exportPdf` | `{ id, target, filePath }` | `{ filePath }` | `WRITE_FAILED` |
| `settings.get` / `settings.update` | shop profile fields | shop profile | `INVALID_FIELD` |
| `settings.clockCheck` | `{ deviceTimeZone }` (the zone the computer reports) | `{ warnings }`, each `TIME_ZONE_DIFFERS` (the device's clock zone is not the shop's, compared by UTC offset now so `Asia/Calcutta` equals `Asia/Kolkata`) or `CLOCK_BEFORE_LAST_BILL` (now is earlier than the newest saved bill) | `INVALID_FIELD` only for a malformed input. Warnings are data, never an error: billing is not blocked (T080, FR-019a) |
| `backup.run` | `{}` | `{ path, finishedAt }` | `BACKUP_FAILED` |
| `backup.status` | `{}` | `{ lastOkAt, lastError? }` | |
| `backup.planRestore` | `{ filePath, lastIssuedBillNo? }`: the last bill number the owner remembers issuing, as printed (for example `C1/26-27/000126`); blank or left out means "cannot say" | `{ nextBillNo, gapRecorded? }`. Read only: nothing is replaced. `nextBillNo` is in the current financial year's series, the one billing uses next, even when the typed last bill is from last year. `gapRecorded` is `{ seqFrom, seqTo, isEstimated }` and is present only when numbers will be lost; `isEstimated` is true when the owner could not say and the counter jumps 100 ahead | `INVALID_BACKUP`; `INVALID_FIELD` when the number is not in the shop's number format, is in another series, has sequence 0, or is from a financial year before the backup's last bill or after the current one (T083, FR-013b) |
| `backup.restore` | `{ filePath, lastIssuedBillNo?, confirmedPreview }`: the same file and number as the plan, plus the whole preview the owner saw (`{ nextBillNo, gapRecorded? }`) | `{ restored, nextBillNo, gapRecorded? }` (app restarts) | As `backup.planRestore`, and `INVALID_BACKUP` when the plan worked out again differs from `confirmedPreview` in the next number or the lost range (the file changed after it was checked); nothing is scheduled then. The numbers are recorded in `bill_number_gap` on a prepared copy before the live database is replaced (T083, FR-013b) |

Not in this release: `import.preview` and `import.commit` moved to feature 012 (decision 2026-11-15).

Status (2026-11-22): `bills.list` and `bills.cancel` are in `packages/core/src/commands.ts` (tasks T067 to T069, 2026-11-17). `settings.get` and `settings.update` gain `docTitle` (1 to 30 characters), `roundBillTotal` and `timeZone` (a named zone the platform knows, else `INVALID_FIELD`) and `receiptWidth` (`58mm`, `80mm`, `a4`, `a5`). Built in T080 (2026-11-16): `bills.save` returns a bill carrying `docTitle` and `roundOffPaise`, and `grandTotalPaise` is the rounded total. The bill's `business_date` is stored in the database but is not a field of the returned `Bill`.

## Guarantees

- `bills.save` runs in one transaction: counter increment, bill, lines, stock movements and cached stock updates either all commit or none do. The saved bill is returned before any printing begins.
- `bills.save` is idempotent: `clientBillId` (a UUID the screen makes when the bill is started) is unique per shop; saving the same id again returns the first bill and its lines and changes nothing (no second bill, number or stock movement), so a double-click, retry or crash-and-retry can never duplicate a bill.

- `bills.cancel` runs in one transaction: it changes the bill's status from Posted to Cancelled, stores the trimmed reason, records the cancellation and update timestamps, and appends one equal and opposite `sale_cancel` movement per line to restore stock. If any step fails, nothing changes. The bill's other fields, its lines, and the original `sale` movements remain unchanged, and its number is never reused. Cancelling again returns `ALREADY_CANCELLED` and changes nothing.
- `bills.save` never rejects for insufficient stock; items that end below zero are reported in `negativeStockItems`.
- No command edits or deletes a saved bill, bill line or stock movement, except that `bills.cancel` may update only the bill's status, trimmed cancellation reason, and cancellation and update timestamps as described above.

