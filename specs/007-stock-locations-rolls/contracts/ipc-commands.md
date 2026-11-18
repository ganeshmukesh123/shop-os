# Contract: commands added or changed by feature 007 (MVP part)

Rules as in `specs/001-shop-os-mvp/contracts/ipc-commands.md`, with 005's session and permission checks.

## Locations

| Command                    | Input                            | Result                                                  | Error codes                                    |
| -------------------------- | -------------------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| `locations.tree`           | `{ includeInactive? }`           | `{ locations[{ id, parentId, kind, name, isActive }] }` |                                                |
| `locations.save`           | `{ id?, parentId?, kind, name }` | `{ location }`                                          | `DUPLICATE_NAME`, `TOO_DEEP`, `INVALID_PARENT` |
| `locations.setActive`      | `{ id, isActive }`               | `{ location }`                                          | `LOCATION_HAS_STOCK`, `SEEDED_LOCATION`        |
| `counters.setSaleLocation` | `{ counterCode, locationId }`    | `{ setting }`                                           |                                                |

## Stock

| Command                  | Input                                                                                      | Result                                                                                                                         | Error codes                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `stock.lookup`           | `{ itemId }`                                                                               | `{ totalMilli, byLocation[{ locationId, path, qtyMilli, isUncounted }], lastPurchasePricePaise?, lastSoldAt?, openRolls: [] }` | `NOT_FOUND`                                                                                                |
| `stock.transfer`         | `{ clientMovementId, itemId, fromLocationId, toLocationId, quantityMilli, note? }`         | `{ movement, balances[] }`                                                                                                     | `SAME_LOCATION`, `INVALID_QUANTITY`                                                                        |
| `stock.adjust` (changed) | 001 input plus `locationId`, `reasonCode`, `approvalId?`; `note` required only for `other` | `{ movement, balance }`                                                                                                        | 001 codes plus `REASON_REQUIRED`, `APPROVAL_REQUIRED` (`stock_adjust_over_threshold`), `PERMISSION_DENIED` |
| `stock.damage`           | `{ clientMovementId, itemId, fromLocationId, quantityMilli, note? }` (to Defective)        | `{ movement }`                                                                                                                 | `APPROVAL_REQUIRED` above threshold                                                                        |
| `stock.setHomeLocation`  | `{ itemId, locationId }`                                                                   | `{ item }`                                                                                                                     |                                                                                                            |
| `stock.negativeList`     | `{}`                                                                                       | `{ rows[{ itemId, locationId, qtyMilli, since }] }` (the open `negative_stock` exceptions)                                     |                                                                                                            |
| `stock.verify`           | `{}` (also at start and nightly)                                                           | `{ checked, mismatches[] }`                                                                                                    |                                                                                                            |

`bills.save` and `bills.cancel` (changed): the sale and its reversal use `chooseSaleLocation` for each line.

## Counts

| Command           | Input                                                       | Result                                                          | Error codes                                                           |
| ----------------- | ----------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `counts.start`    | `{ locationId, kind: "opening" }`                           | `{ session }`                                                   | `SESSION_ALREADY_OPEN` (one open session per location)                |
| `counts.record`   | `{ sessionId, itemId, countedMilli }` (from scan or search) | `{ line, bookMilliAtCount }`                                    | `INVALID_QUANTITY`, `SESSION_DONE`                                    |
| `counts.lines`    | `{ sessionId }`                                             | `{ lines[{ item, countedMilli, bookMilli, differenceMilli }] }` |                                                                       |
| `counts.markDone` | `{ sessionId, approvalId? }`                                | `{ session, corrections[] }`                                    | `APPROVAL_REQUIRED` (after go-live, above threshold), `EMPTY_SESSION` |
| `counts.progress` | `{ locationId? }`                                           | `{ racksDone, racksTotal, uncountedItems }`                     |                                                                       |

Guarantees: each movement and its balance update are one transaction; `counts.markDone` posts every correction and closes the session in one transaction; no command updates or deletes a movement, count line or balance history.
