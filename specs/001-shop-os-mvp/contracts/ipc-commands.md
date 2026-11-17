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
| `bills.print` | `{ id, target: "receipt" or "a4" or "a5" }` | `{ printed }` | `PRINT_FAILED` (bill is unaffected) |
| `bills.exportPdf` | `{ id, target, filePath }` | `{ filePath }` | `WRITE_FAILED` |
| `settings.get` / `settings.update` | shop profile fields | shop profile | `INVALID_FIELD` |
| `backup.run` | `{}` | `{ path, finishedAt }` | `BACKUP_FAILED` |
| `backup.status` | `{}` | `{ lastOkAt, lastError? }` | |
| `backup.restore` | `{ filePath, lastIssuedBillNo? }` | `{ restored, nextBillNo, gapRecorded? }` (app restarts) | `INVALID_BACKUP`, `INVALID_FIELD` (bill number not in this series) |

Not in this release: `import.preview` and `import.commit` moved to feature 012 (decision 2026-11-15).

Status (2026-11-15): `bills.list` and `bills.cancel` are in `packages/core/src/commands.ts` (tasks T067 to T069, 2026-11-17). `bills.save` returns `round_off_paise`, `doc_title` and `business_date` on the bill once T079 to T081 land; `settings.get` and `settings.update` gain `docTitle`, `roundBillTotal`, `timeZone` and `receiptWidth` (`58mm`, `80mm`, `a4`, `a5`).

## Guarantees

- `bills.save` runs in one transaction: counter increment, bill, lines, stock movements and cached stock updates either all commit or none do. The saved bill is returned before any printing begins.
- `bills.save` is idempotent: `clientBillId` (a UUID the screen makes when the bill is started) is unique per shop; saving the same id again returns the first bill and its lines and changes nothing (no second bill, number or stock movement), so a double-click, retry or crash-and-retry can never duplicate a bill.
- `bills.cancel` runs in one transaction: the bill becomes Cancelled with the trimmed reason, and one equal and opposite `sale_cancel` movement per line gives the stock back, or nothing changes. The bill, its lines and the original `sale` movements are never edited and its number is never reused. Cancelling again returns `ALREADY_CANCELLED` and changes nothing.
- `bills.save` never rejects for insufficient stock; items that end below zero are reported in `negativeStockItems`.
- No command edits or deletes a saved bill, bill line or stock movement.
