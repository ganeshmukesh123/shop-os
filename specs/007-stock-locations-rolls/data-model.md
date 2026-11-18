# Data Model: Stock by Location, Counts and Adjustments (MVP part of feature 007)

Builds on 001 (`location`, `stock_movement`), 002 (`item_variant` fields, `exception_event`, `service` kind), 003 (movement types, `defective` location) and 005 (users, permissions, approvals, audit). Conventions unchanged. Decisions in `research.md` D1 to D8.

## Overview

```
location (tree: Shop floor > R1..R20, Godown > G1..G10, Defective, Tinted returns, Godown 2)
   1--* stock_balance *--1 item_variant (home_location_id -> location)
   1--* stock_movement (from / to; transfer has both)
   1--* count_session 1--* count_line *--1 item_variant
counter_setting.sale_location_id -> location
```

## Changed tables

### `location`

| Field     | Rule                                                                                |
| --------- | ----------------------------------------------------------------------------------- |
| parent_id | nullable FK to `location`; depth at most 3 (service check); not itself              |
| kind      | `shop_floor`, `godown`, `defective`, `tinted_returns`, `rack`, `other`              |
| name      | 1-80, unique among siblings, case-insensitive                                       |
| is_active | 0 or 1; a location with non-zero stock cannot be deactivated (`LOCATION_HAS_STOCK`) |

Seeded: Godown and Defective (if 003 has not), so every shop has at least Shop floor, Godown and Defective (FR-003).

### `stock_movement` (append-only; no rebuild)

002 made movement types, document types and their rules lookup data with one rule trigger (002 research D17), so this feature only inserts rows and adds nullable columns (`ALTER TABLE ADD COLUMN`, additive and rollback-safe under 012 D10).

| Change                  | Rule                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `movement_type` rows    | `transfer` (direction `both`), `damage` (direction `both`, reason required), `count_correction` (in or out, doc required); `transfer_out` and `transfer_in` reserved for outlet transfers (Later) |
| locations               | enforced by 002's rule trigger from `direction`: `both` needs two different locations, `in` and `out` exactly one                                                                                 |
| `reason_code`           | foreign key to a new `reason_code` lookup (`damage`, `theft`, `count_error`, `sample`, `personal_use`, `tinting_waste`, `other`); required when the type's `requires_reason` is set               |
| note                    | required when `reason_code = 'other'` (rule trigger)                                                                                                                                              |
| approval_id             | new nullable column, FK to `approval_request`                                                                                                                                                     |
| `movement_doc_type` row | `count_session` (for `count_correction`)                                                                                                                                                          |
| roll_id                 | new nullable column, reserved for V2 rolls (no FK until `roll` exists)                                                                                                                            |
| user_id                 | from 005                                                                                                                                                                                          |

### `item_variant`

Adds `home_location_id` (nullable FK to `location`) and `is_sold_from_rolls` (0 or 1, default 0, reserved).

### Counter setting

`counter_setting(counter_code, sale_location_id)`; default Shop floor.

## New tables

### `stock_balance` (projection)

`variant_id`, `location_id`, `qty_base_milli` (signed), `first_counted_at` (nullable epoch ms), `last_movement_at`. `UNIQUE(variant_id, location_id)`. Updated in the movement's transaction; rebuilt from movements by `rebuildStockBalances`.

### `count_session`

`kind` (`opening`; `cycle` reserved), `location_id` (a rack or a top-level location), `status` (`open`, `done`), `started_at`, `started_by`, `done_at`, `done_by`. Status may move only from `open` to `done`.

### `count_line` (append-only)

`session_id`, `variant_id`, `location_id`, `counted_qty_milli` (0 or more; whole thousands for variants without decimals), `counted_at`, `user_id`. A later line for the same variant in the same session supersedes the earlier one when posting (the helper recounted); both are kept.

## Derived values (in `@shopos/core`)

- `signedQuantityAt(movement, locationId)`: +qty when `to` is the location, -qty when `from` is.
- `balanceAt(movements, variantId, locationId, atMs)`.
- `countCorrection({ countedMilli, bookMilliAtCount })` returning the correction movement or none.
- `chooseSaleLocation({ homeLocationId, saleLocationId, locationTree })`.
- `adjustmentValuePaise({ qtyMilli, costPerBaseUnitPaise })` and `needsAdjustmentApproval(value, threshold)`.
- `countProgress(sessions, racksWithItems)`.
- `subtreeQuantity(balances, locationTree, locationId)`.

Example: R3 book 40 at 10:00, counted 37 at 10:05, sale 2 at 10:10: correction -3 at 10:05; balance after the sale 35.

## Indexes

- `location(parent_id)`; `stock_balance(location_id)`; `stock_movement(from_location_id)`, `stock_movement(to_location_id)`.
- `count_line(session_id, variant_id)`; `count_session(location_id, status)`.
