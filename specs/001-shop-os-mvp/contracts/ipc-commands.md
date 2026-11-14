# Contract: Renderer to main-process commands

The UI (renderer) never touches the database. It calls these typed commands through the preload bridge. Every command returns `{ ok: true, data }` or `{ ok: false, code, message }`. Money is integer paise and quantity is integer thousandths on the wire. Validation uses the same Zod schemas in `shopos_core` on both sides.

| Command | Input | Result | Error codes |
|---|---|---|---|
| `items.list` | `{ query?, includeInactive?, needsCorrection?, limit, offset }` | `{ items[], total }` | |
| `items.create` | `{ name, unit, allowsDecimal?, pricePaise, openingQtyMilli }` | `{ item }` | `DUPLICATE_NAME` (returns the matching items), `INVALID_QUANTITY` |
| `items.update` | `{ id, name?, unit?, pricePaise?, active? }` | `{ item }` | `DUPLICATE_NAME`, `NOT_FOUND` |
| `stock.adjust` | `{ itemId, mode: "add" or "set", quantityMilli, note }` | `{ item, movement }` | `INVALID_QUANTITY`, `NOTE_REQUIRED` |
| `import.preview` | `{ filePath }` | `{ rows[], errors[], duplicates[] }` (nothing saved) | `UNREADABLE_FILE` |
| `import.commit` | `{ previewId }` | `{ created }` | `PREVIEW_EXPIRED` |
| `bills.draft.save` | `{ payload }` | `{}` | |
| `bills.draft.load` | `{}` | `{ payload or null }` | |
| `bills.save` | `{ clientBillId, customerName?, paymentMode, billDiscountPaise, lines[{ itemId, quantityMilli, ratePaise, lineDiscountPaise }] }` | `{ bill, negativeStockItems[] }` | `EMPTY_BILL`, `INVALID_QUANTITY`, `INVALID_DISCOUNT`, `ITEM_INACTIVE` |
| `bills.list` | `{ number?, from?, to?, customer?, status?, limit, offset }` | `{ bills[], total }` | |
| `bills.get` | `{ id }` | `{ bill, lines[] }` | `NOT_FOUND` |
| `bills.cancel` | `{ id, reason }` | `{ bill }` | `ALREADY_CANCELLED`, `REASON_REQUIRED` |
| `bills.print` | `{ id, target: "receipt" or "a4" or "a5" }` | `{ printed }` | `PRINT_FAILED` (bill is unaffected) |
| `bills.exportPdf` | `{ id, target, filePath }` | `{ filePath }` | `WRITE_FAILED` |
| `settings.get` / `settings.update` | shop profile fields | shop profile | `INVALID_FIELD` |
| `backup.run` | `{}` | `{ path, finishedAt }` | `BACKUP_FAILED` |
| `backup.status` | `{}` | `{ lastOkAt, lastError? }` | |
| `backup.restore` | `{ filePath }` | `{ restored }` (app restarts) | `INVALID_BACKUP` |

## Guarantees

- `bills.save` runs in one transaction: counter increment, bill, lines, stock movements and cached stock updates either all commit or none do. The saved bill is returned before any printing begins.
- `bills.save` is idempotent: `clientBillId` (a UUID the screen makes when the bill is started) is unique per shop; saving the same id again returns the first bill and its lines and changes nothing (no second bill, number or stock movement), so a double-click, retry or crash-and-retry can never duplicate a bill.
- `bills.save` never rejects for insufficient stock; items that end below zero are reported in `negativeStockItems`.
- No command edits or deletes a saved bill, bill line or stock movement.
