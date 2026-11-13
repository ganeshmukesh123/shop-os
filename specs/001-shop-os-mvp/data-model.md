# Data Model: Shop OS MVP

Conventions for every table: `id` UUID v7 text primary key; `business_id` and `shop_id` UUID text, not null; `created_at` and `updated_at` as ISO-8601 UTC text, not null. Money columns are integer paise; quantity columns are integer thousandths of the item's unit. Saved bills, bill lines and stock movements are never updated or deleted by the app.

## Entities

### Item (`item`)
| Field | Rule |
|---|---|
| name | text, not null, 1-120 characters, trimmed; unique per shop among active items, case-insensitive (duplicate gives a warning the user may override only by changing the name) |
| unit | text, not null, one of `pcs`, `metre`, `kg`, `litre`, `box`, or a custom name up to 20 characters |
| allows_decimal | integer 0 or 1, not null; derived default: 1 for metre/kg/litre, 0 otherwise; custom units choose at creation |
| price_paise | integer, not null, 0 or more |
| stock_milli | integer, not null, cached sum of movements (may be negative) |
| active | integer 0 or 1, not null, default 1; items are deactivated, never deleted |
| low_stock_flag | derived: stock_milli below 0 |

Reserved but unused columns so later features need no migration: `hsn`, `gst_rate_bp`, `barcode` (all nullable, not shown in the UI).

### Stock Movement (`stock_movement`)
| Field | Rule |
|---|---|
| item_id | foreign key to item, not null |
| quantity_milli | integer, not null, non-zero; positive adds stock, negative removes |
| reason | one of `opening`, `adjustment`, `sale`, `sale_cancel`, not null |
| note | text up to 200 characters, optional (required text for `adjustment`) |
| bill_id | foreign key to bill, set for `sale` and `sale_cancel`, else null |
| occurred_at | ISO-8601 UTC, not null |
| device_id | text, not null (the local device identifier) |

Append-only. Invariant: item.stock_milli equals the sum of the item's movements.

### Bill (`bill`)
| Field | Rule |
|---|---|
| number | text, not null, unique per shop; formatted from series, financial year and counter |
| series_code | text, not null (for example `C1`) |
| financial_year | text, not null (for example `26-27`; 1 April to 31 March, from the local bill date) |
| seq | integer, not null, unique with series and financial year |
| bill_date | ISO-8601 local timestamp, not null |
| customer_name | text up to 80 characters, optional |
| customer_phone | text, optional, digits only, 10-15 characters when present |
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
- `bill`: delete is rejected; update is allowed only for the change `status` `saved` to `cancelled` (with its cancel fields) while every other column stays identical.
- Consequence: customer fields on a saved bill cannot be edited or erased later. See review finding B6 (privacy erasure) for the open decision.

## Rounding (implemented in `packages/core/src/money.ts`)

- Line amount = quantity (thousandths) times rate (paise) divided by 1000, rounded half up, then minus the line discount. Rounding happens once per line.
- Percent discounts are held in basis points (12.5% = 1250), converted to paise by rounding half up, and stored as paise; only paise are saved.
- Bill discount is applied to the lines total after line rounding; grand total = lines total minus bill discount (no further rounding).
- Amounts above the safe integer limit are rejected.

## Time

- Timestamps in the audit-style columns (`created_at`, `updated_at`, `occurred_at`, `cancelled_at`) are ISO-8601 UTC.
- `bill_date` is the device's local time as ISO-8601 text; the financial year and "same day" rules use that local date.
- Open item (review M3): the business time zone is not yet fixed to Asia/Kolkata in code; it uses the device's time zone. To be decided and tested at the 31 March and 1 April boundary.

## Relationships

- Item 1 to many Stock Movement; Bill 1 to many Bill Line and Bill 1 to many Stock Movement (via bill_id); Bill Line many to 1 Item.
- Business 1 to many Shop; every table above carries both ids (single business and shop at launch).

## State transitions

- Bill: `saved` to `cancelled` only, once, with a reason. Cancelled is terminal. A cancel inserts one `sale_cancel` movement per line (the exact reverse of the sale) in one transaction.
- Item: `active` to inactive and back; inactive items cannot be added to new bills but remain on old bills.

## Derived values (computed in `shopos_core`)

- Line amount, bill total, change due (display only).
- Current stock = sum of movements; negative stock is flagged and listed in the Items screen filter "Needs correction".

## Indexes

- `item(name)` collation NOCASE plus an FTS or prefix-search structure for partial-name search.
- `stock_movement(item_id, occurred_at)`.
- `bill(number)` unique; `bill(bill_date)`; `bill(customer_name)`.
- `bill_line(bill_id)`.
