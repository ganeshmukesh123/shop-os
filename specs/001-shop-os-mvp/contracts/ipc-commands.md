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
| `bills.list` | `{ number?, from?, to?, customer?, status?, limit, offset }` | `{ bills[], total }` | `status` is `posted` or `cancelled` (T076; it was `saved`) |
| `bills.get` | `{ id }` | `{ bill, lines[] }` | `NOT_FOUND` |
| `bills.cancel` | `{ id, reason }` | `{ bill }` | `ALREADY_CANCELLED`, `REASON_REQUIRED` |
| `bills.print` | `{ id, target: "receipt" or "a4" or "a5" }` | `{ printed }` | `PRINT_FAILED` (bill is unaffected) |
| `bills.exportPdf` | `{ id, target, filePath }` | `{ filePath }` | `WRITE_FAILED` |
| `settings.get` / `settings.update` | shop profile fields | shop profile | `INVALID_FIELD` |
| `settings.clockCheck` | `{ deviceTimeZone }` (the zone the computer reports) | `{ warnings }`, each `TIME_ZONE_DIFFERS` (the device's clock zone is not the shop's, compared by UTC offset now so `Asia/Calcutta` equals `Asia/Kolkata`) or `CLOCK_BEFORE_LAST_BILL` (now is earlier than the newest saved bill) | `INVALID_FIELD` only for a malformed input. Warnings are data, never an error: billing is not blocked (T080, FR-019a) |
| `backup.run` | `{}` | `{ path, finishedAt }` | `BACKUP_FAILED` |
| `backup.status` | `{}` | `{ lastOkAt, lastError? }` | |
| `backup.restore` | `{ filePath, lastIssuedBillNo? }` | `{ restored, nextBillNo, gapRecorded? }` (app restarts) | `INVALID_BACKUP`, `INVALID_FIELD` (bill number not in this series) |

Not in this release: `import.preview` and `import.commit` moved to feature 012 (decision 2026-11-15).

Status (2026-11-15): `bills.list` and `bills.cancel` are not yet in `packages/core/src/commands.ts` (tasks T067 to T069). `settings.get` and `settings.update` gain `docTitle` (1 to 30 characters), `roundBillTotal` and `timeZone` (a named zone the platform knows, else `INVALID_FIELD`) and `receiptWidth` (`58mm`, `80mm`, `a4`, `a5`). Built in T080 (2026-11-16): `bills.save` returns a bill carrying `docTitle` and `roundOffPaise`, and `grandTotalPaise` is the rounded total. The bill's `business_date` is stored in the database but is not a field of the returned `Bill`.

## Guarantees

- `bills.save` runs in one transaction: counter increment, bill, lines, stock movements and cached stock updates either all commit or none do. The saved bill is returned before any printing begins.
- `bills.save` is idempotent: `clientBillId` (a UUID the screen makes when the bill is started) is unique per shop; saving the same id again returns the first bill and its lines and changes nothing (no second bill, number or stock movement), so a double-click, retry or crash-and-retry can never duplicate a bill.
- `bills.save` never rejects for insufficient stock; items that end below zero are reported in `negativeStockItems`.
- No command edits or deletes a saved bill, bill line or stock movement.
