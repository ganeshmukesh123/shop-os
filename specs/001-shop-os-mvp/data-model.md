# Data Model: Shop OS MVP

> **Two shapes in this file (2026-11-15).** "Target shape" below is the decided schema (research D18), built by tasks T073 to T081. The sections after it ("Entities" onward) describe the schema in the code today (migrations 0000 to 0007; items moved in T074, stock movements and locations in T075) until those tasks land; each is replaced as its table moves. The `bill_number_len` check (number at most 16 characters, migration 0004) is in force.

## Target shape (research D18, architecture section 8)

Conventions: `id` UUID v7 text primary key; `business_id` and `shop_id` not null on every table; `created_at` and `updated_at` INTEGER epoch milliseconds (UTC); money `*_paise` integer; quantity `*_milli` integer thousandths of the base unit. Enums are text with a CHECK.

```
item_family 1--* item_variant 1--* bill_line *--1 bill 1--* bill_tender
                      |                              |
                      1--* stock_movement *--1 location   1--* bill_number_gap (via number_series)
number_series 1--* bill            shop_profile (one row)
```

| Table | Columns (this release) | Rules |
|---|---|---|
| `item_family` | `name` | One family per item for now; feature 002 adds category, brand, spec |
| `item_variant` | `family_id`, `item_code`, `display_name`, `base_uom`, `allow_decimal`, `selling_price_paise`, `is_active`, `stock_milli` (cache), reserved nullable `hsn_code`, `gst_rate_override_bp`, `barcode` | `UNIQUE(business_id, item_code)`; name unique per shop among active variants, case-insensitive (warning) |
| `location` | `name`, `kind` | One seeded row "Shop floor"; feature 007 adds more |
| `stock_movement` | `variant_id`, `movement_type` (`opening`, `adjustment`, `sale`, `sale_cancel`), `qty_base_milli` (always > 0), `from_location_id`, `to_location_id`, `doc_type`, `doc_id`, `reason_code`, `note`, `device_id`, `occurred_at` | Append-only (triggers). Direction from the locations: stock in has only `to`, stock out only `from`. Adjustment needs a note |
| `bill` | `device_id`, `counter_code`, `bill_no`, `number_series_id`, `seq`, `financial_year`, `doc_title`, `status` (`posted`, `cancelled`), `business_date` (text `YYYY-MM-DD` in the shop zone), `billed_at`, `customer_name`, `client_bill_id`, `subtotal_paise`, `bill_discount_paise`, `round_off_paise`, `total_paise`, `cancel_reason`, `cancelled_at` | `UNIQUE(shop_id, bill_no)`, `length(bill_no) <= 16`, `total = subtotal - discount + round_off`, `abs(round_off) <= 50`; no delete; update only posted to cancelled |
| `bill_line` | `bill_id`, `line_no`, `variant_id`, `item_name_snapshot`, `unit_snapshot`, `qty_base_milli`, `unit_price_paise`, `line_discount_paise`, `amount_paise` | Append-only |
| `bill_tender` | `bill_id`, `mode` (`cash`, `upi`, `card`, `unpaid`), `amount_paise`, `status` (`label` in this release) | One row per bill in this release; append-only |
| `number_series` | `counter_code`, `financial_year`, `template`, `last_seq` | Incremented in the bill transaction |
| `bill_number_gap` | `number_series_id`, `seq_from`, `seq_to`, `reason` (`lost_in_restore`), `recorded_at` | Append-only; shown in the bill list (D21) |
| `shop_profile` | name, address, phone, `doc_title` (default `Estimate`), `number_template`, `round_bill_total` (default 1), `time_zone` (default `Asia/Kolkata`), `receipt_width` (`58mm`, `80mm` default, `a4`, `a5`), footer, backup folder | One row |
| `draft_bill`, `backup_log` | as today | Not financial records |

## Current schema (until T073 to T081)

Conventions for every table: `id` UUID v7 text primary key; `business_id` and `shop_id` UUID text, not null; `created_at` and `updated_at` as ISO-8601 UTC text, not null. Money columns are integer paise; quantity columns are integer thousandths of the item's unit. Saved bills, bill lines and stock movements are never updated or deleted by the app.

## Entities

### Item family (`item_family`) and item variant (`item_variant`) (migrations 0005 and 0006, task T074)
An item is one family with one variant for now; the code and screens still say "item" and see the variant's fields. The variant keeps the id the item had before the split, so older stock movements and bill lines point at the same row.

| Field (`item_variant`) | Rule |
|---|---|
| family_id | foreign key to `item_family`, not null; the family holds the same name |
| item_code | text, not null, `ITM-0001`, `ITM-0002`, ...; unique per business; the next code is the highest number plus one |
| display_name | text, not null, 1-120 characters, trimmed; unique per shop among active items, case-insensitive (duplicate gives a warning the user may override only by changing the name) |
| base_uom | text, not null, one of `pcs`, `metre`, `kg`, `litre`, `box`, or a custom name up to 20 characters |
| allow_decimal | integer 0 or 1, not null; derived default: 1 for metre/kg/litre, 0 otherwise; custom units choose at creation |
| selling_price_paise | integer, not null, 0 or more |
| stock_milli | integer, not null, cached sum of movements (may be negative) |
| is_active | integer 0 or 1, not null, default 1; items are deactivated, never deleted |
| low_stock_flag | derived: stock_milli below 0 |

Reserved but unused columns so later features need no migration: `hsn_code`, `gst_rate_override_bp`, `barcode` (all nullable, not shown in the UI). `item_family` has only `name` (1-120 characters, trimmed) plus the base columns.

### Location (`location`) (migration 0007, task T075)
`name` (1-80 characters) and `kind` (`shop_floor` or `godown`). Each shop has one seeded row, "Shop floor" (`shop_floor`); feature 007 adds more. The seed creates it on first run, and migration 0007 creates it for a shop that already exists.

### Stock Movement (`stock_movement`) (migration 0007, task T075)
| Field | Rule |
|---|---|
| variant_id | foreign key to `item_variant`, not null |
| movement_type | one of `opening`, `adjustment`, `sale`, `sale_cancel`, not null |
| qty_base_milli | integer, not null, always above 0 |
| from_location_id, to_location_id | foreign keys to `location`; exactly one is set: stock in has only `to`, stock out only `from` (transfers, with both set, come with feature 007) |
| doc_type, doc_id | `bill` and the bill's id for `sale` and `sale_cancel`; both null otherwise (checked as a pair) |
| reason_code | text, optional, unused in this release |
| note | text up to 200 characters, optional; required (not blank) for `adjustment` |
| occurred_at | ISO-8601 UTC, not null |
| device_id | text, not null (the local device identifier) |

Append-only. The signed change is `+qty` when `to_location_id` is set and `-qty` when `from_location_id` is set (`signedQuantityMilli` and `movementLocations` in `@shopos/core`); the repository still hands the app a signed `quantityMilli`. Invariant: variant.stock_milli equals the sum of the variant's signed movements.

### Bill (`bill`)
| Field | Rule |
|---|---|
| number | text, not null, unique per shop; formatted from series, financial year and counter |
| series_code | text, not null (for example `C1`) |
| client_bill_id | text, unique per shop (idempotency key from the screen that started the bill); null only for bills saved before it existed; never changes after save |
| financial_year | text, not null (for example `26-27`; 1 April to 31 March, from the local bill date) |
| seq | integer, not null, unique with series and financial year |
| bill_date | ISO-8601 local timestamp, not null |
| customer_name | text up to 80 characters, optional |
| payment_mode | one of `cash`, `upi`, `card`, `unpaid`, not null |
| lines_total_paise | integer, not null |
| bill_discount_paise | integer, not null, 0 up to lines_total_paise |
| grand_total_paise | integer, not null = lines_total_paise minus bill_discount_paise |
| status | `saved` or `cancelled`, not null |
| cancel_reason | text, required when status is `cancelled` |
| cancelled_at | ISO-8601 UTC, set on cancel |

### Bill Line (`bill_line`)
| Field | Rule |
|---|---|
| bill_id | foreign key, not null |
| line_no | integer, not null, from 1 |
| item_id | foreign key, not null |
| item_name_snapshot | text, not null (name at time of sale so reprints stay identical) |
| unit_snapshot | text, not null |
| quantity_milli | integer, not null, greater than 0; whole thousands only when the item does not allow decimals |
| rate_paise | integer, not null, 0 or more |
| line_discount_paise | integer, not null, 0 up to quantity times rate |
| amount_paise | integer, not null = quantity times rate (rounded half up) minus line_discount_paise |

### Shop Profile (`shop_profile`)
One row: name (required, up to 80), address (up to 200), phone (up to 20), bill series code, bill number template, bill footer text (up to 200), receipt width (`58mm` or `80mm`), backup folder path.

### Number Counter (`number_counter`)
`series_code`, `financial_year`, `last_seq`; incremented in the same transaction as the bill insert.

### Draft Bill (`draft_bill`)
`payload` JSON of an unsaved bill, written on every edit and cleared on save or discard; supports crash recovery. Not a financial record.

### Backup Log (`backup_log`)
`path`, `started_at`, `finished_at`, `status` (`ok` or `failed`), `error` text, so the owner can see when the last good backup happened.

## Enforced immutability (database triggers, migration `0001_immutability_triggers`)

- `stock_movement`: update and delete are rejected ("append-only").
- `bill_line`: update and delete are rejected.
- `bill`: delete is rejected (also the key `client_bill_id` is protected); update is allowed only for the change `status` `saved` to `cancelled` (with its cancel fields) while every other column stays identical.
- Consequence: the optional `customer_name` on a saved bill cannot be edited or erased later. Customer phone was removed from the bill (migration `0002`, 2026-11-13) so this release holds no contact details. When contact details arrive (features 004 and 008) they live in a separate, erasable party record referenced by id (review B6).

## Rounding (implemented in `packages/core/src/money.ts`)

- Line amount = quantity (thousandths) times rate (paise) divided by 1000, rounded half up, then minus the line discount. Rounding happens once per line.
- Percent discounts are held in basis points (12.5% = 1250), converted to paise by rounding half up, and stored as paise; only paise are saved.
- Bill discount is applied to the lines total after line rounding; grand total = lines total minus bill discount (no further rounding).
- Amounts above the safe integer limit are rejected.

## Time

- Timestamps in the audit-style columns (`created_at`, `updated_at`, `occurred_at`, `cancelled_at`) are ISO-8601 UTC.
- `bill_date` is the device's local time as ISO-8601 text; the financial year and "same day" rules use that local date.
- Decided 2026-11-15 (research D22): the business time zone is the shop setting `time_zone` (default `Asia/Kolkata`), not the device's. Until task T079 lands, the code still uses the device's time zone.

## Rounding of the bill total (research D20, target)

- Grand total before rounding = lines total minus bill discount.
- When `round_bill_total` is on: round to the nearest 100 paise, 50 paise and above up; `round_off_paise` = rounded minus unrounded (between -49 and +50). Example: ₹849.60 gives round-off +₹0.40, total ₹850.00; ₹849.49 gives -₹0.49, total ₹849.00.
- When off: `round_off_paise` is 0.

## Relationships

- Item variant 1 to many Stock Movement; Location 1 to many Stock Movement (from or to); Bill 1 to many Bill Line and Bill 1 to many Stock Movement (via doc_type `bill` and doc_id); Bill Line many to 1 Item variant.
- Business 1 to many Shop; every table above carries both ids (single business and shop at launch).

## State transitions

- Bill: `saved` to `cancelled` only, once, with a reason. Cancelled is terminal. A cancel inserts one `sale_cancel` movement per line (the exact reverse of the sale) in one transaction.
- Item: `active` to inactive and back; inactive items cannot be added to new bills but remain on old bills.

## Derived values (computed in `@shopos/core`)

- Line amount, bill total, change due (display only).
- Current stock = sum of movements; negative stock is flagged and listed in the Items screen filter "Needs correction".

## Indexes

- `item_variant(display_name)` collation NOCASE for partial-name search (no FTS needed: 5,000 items searched in about 4 ms); `item_variant(business_id, item_code)` unique.
- `stock_movement(variant_id, occurred_at)` and `stock_movement(doc_type, doc_id)`.
- `bill(number)` unique; `bill(bill_date)`; `bill(customer_name)`.
- `bill_line(bill_id)`.
