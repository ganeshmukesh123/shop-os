# Data Model: Advanced Counter Billing

Builds on 001's target shape and 002's data model (variants, conversions, `price_tier`, `item_price`, `item_batch`, tinted lines). Uses tables owned by 004 (`party`, `party_price`, `party_ledger_entry`, `consent_record`) and 005 (`app_user`, `approval_request`, `audit_log`) by id. Conventions unchanged (UUID v7 ids, `business_id` and `shop_id`, epoch-millisecond times, paise and thousandths, text enums with CHECK). Decisions in `research.md` D1 to D16.

## Overview

```
quotation (versions) 1--* quotation_line
      |                        |
      0..1                     0..1
bill (versions share bill_no) 1--* bill_line 1--* sales_return_line *--1 sales_return
  |  previous_version_id -> bill        |                                 |
  1--* bill_tender 1--* tender_resolution                                0..1 credit_note
  *--0..1 party (004)            bill_line *--0..1 item_batch (002)
held_bill (drafts)   unmet_demand   bill_number_gap (001, new reason)
```

## Changed tables

### `bill`

| Field                 | Rule                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| version_no            | integer, not null, default 1                                                                     |
| previous_version_id   | nullable FK to `bill`; set exactly when `version_no > 1` (CHECK)                                 |
| edit_reason           | text 1-200, required when `version_no > 1`                                                       |
| party_id              | nullable FK to `party` (004)                                                                     |
| price_tier_id         | FK to `price_tier`, not null, default Retail                                                     |
| place_of_supply_state | text, 2 digits, not null, default the shop's `home_state_code`                                   |
| quotation_id          | nullable FK to `quotation`                                                                       |
| cancel_approval_id    | nullable FK to `approval_request`; required when status becomes `cancelled` from this feature on |
| user_id               | FK to `app_user` (005): who saved this version                                                   |

Unique index changes from `(shop_id, bill_no)` to `(shop_id, bill_no, version_no)`; `UNIQUE(previous_version_id)` so a version is replaced at most once. The 001 trigger (only `posted` to `cancelled` may change) is unchanged. A version row is never updated to mark it superseded: "current" means no row has it as `previous_version_id`.

### `bill_line` (append-only)

| Field                     | Rule                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------ |
| batch_id                  | nullable FK to `item_batch`                                                          |
| mrp_cap_paise             | nullable integer; CHECK `mrp_cap_paise is null or unit_price_paise <= mrp_cap_paise` |
| cost_paise                | from 002 (cost per line); also used for the below-cost check                         |
| is_manual_price           | 0 or 1: the user typed the price, so a tier change does not reprice it               |
| bill_discount_share_paise | integer 0 or more; sum over the version's lines = `bill.bill_discount_paise`         |
| approval_id               | nullable FK to `approval_request` (below cost or over discount on this line)         |
| quotation_line_id         | nullable FK to `quotation_line`                                                      |

### `bill_tender` (append-only)

| Field          | Rule                                                                             |
| -------------- | -------------------------------------------------------------------------------- |
| mode           | adds `credit`; keeps `cash`, `upi`, `card`, `unpaid` (001 bills)                 |
| status         | `label` (001 bills), `settled`, `pending_confirmation`                           |
| reference      | text up to 40, nullable; unique per business for UPI (partial unique index)      |
| tendered_paise | nullable, cash only, at least `amount_paise`; change due = tendered minus amount |
| approval_id    | nullable: over-credit approval for a credit tender                               |

Rules: tenders of a version sum to its `total_paise`; a `credit` tender needs `bill.party_id`; a `upi` tender without a reference is `pending_confirmation`.

### `item_batch` (from 002)

Adds `mrp_pack_qty_milli` integer above 0, default 1000. Cap per base unit = `mrp_paise x 1000 / mrp_pack_qty_milli`, rounded down.

### `stock_movement`

`movement_type` adds `edit_reverse` and `sale_return`; `doc_type` adds `sales_return`. Rebuilt with triggers re-created (as in 002).

### `shop_profile`

Adds `home_state_code` (2 digits), `upi_vpa` (text up to 60, nullable), `upi_payee_name` (up to 50), `quote_validity_days` (default 7, 1 to 90).

### `location`

`kind` adds `defective`; one seeded "Defective" row per shop.

### `bill_number_gap` (001)

`reason` adds `device_crash`.

### `number_series` (001)

Gains `doc_kind` (`bill` default, `return`, `quotation`, `credit_note`); unique per shop, counter, financial year and `doc_kind`. Templates for the new kinds default to `R{counter}/{fy}/{seq6}`, `Q{counter}/{fy}/{seq6}`, `CN{counter}/{fy}/{seq5}`; all at most 16 characters.

## New tables

### `tender_resolution` (append-only)

`tender_id` FK, `kind` (`confirmed`, `replaced`), `reference` (required for `confirmed`), `replacement_mode` (`cash`, `card`, `upi`, `credit`; required for `replaced`), `replacement_reference`, `user_id`, `resolved_at`. At most one resolution per tender (unique `tender_id`).

### `held_bill`

`counter_code`, `label` (up to 40), `payload` JSON, `held_at`. At most 10 per counter (checked in the service in the same transaction as the insert). Deleted on recall.

### `sales_return` (append-only)

| Field                                          | Rule                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| return_no, number_series_id, seq               | from the `return` series; `UNIQUE(shop_id, return_no)`; at most 16 characters |
| bill_id                                        | nullable FK to `bill` (the version returned against)                          |
| party_id                                       | nullable FK to `party`                                                        |
| approval_id                                    | nullable FK; CHECK `bill_id is not null or approval_id is not null`           |
| refund_mode                                    | `cash`, `upi`, `credit_note`                                                  |
| refund_total_paise                             | integer, 0 or more = sum of line refunds                                      |
| reason                                         | text 1-200                                                                    |
| business_date, returned_at, user_id, device_id | as on bills                                                                   |

### `sales_return_line` (append-only)

`return_id`, `bill_line_id` (nullable only for no-bill returns), `variant_id`, `qty_base_milli > 0`, `refund_paise >= 0`, `to_location_id` (shop floor, `defective` or `tinted_returns`), `write_down_paise` (nullable, tinted returns), `approval_id` (nullable, tinted returns). Sum of returned quantity per `bill_line_id` at most the sold quantity (service check, tested).

### `credit_note` (append-only)

`credit_note_no` from its series, `return_id` FK unique, `party_id` not null, `amount_paise > 0`. Feature 004 writes the matching ledger entry in the same transaction.

### `quotation` and `quotation_line`

`quotation`: `quotation_no`, `version_no`, `previous_version_id` (as bills), `party_id` or `customer_name`, `price_tier_id`, `valid_until` (business date text), subtotal, discount, round-off and total as on bills, `user_id`. `UNIQUE(shop_id, quotation_no, version_no)`. Append-only.
`quotation_line`: as `bill_line` without stock fields (`variant_id`, snapshots, `qty_base_milli`, `entered_uom`, `qty_entered_milli`, `unit_price_paise`, `line_discount_paise`, `amount_paise`). Append-only. Open quantity is derived.

### `unmet_demand`

`text` (1-120) or `variant_id`, at least one; `party_id` nullable; `counter_code`; `recorded_at`.

## Derived values (in `@shopos/core`)

- `resolveUnitPrice({ partyPrice, tierPrice, retailPrice })`.
- `spreadBillDiscount(lineAmountsPaise, billDiscountPaise)`: proportional shares, remainder on the last line.
- `checkDiscountLimit({ grossPaise, lineDiscountsPaise, billDiscountPaise, limitBp })`.
- `mrpCapPerBaseUnit({ mrpPaise, mrpPackQtyMilli })`, `checkPriceGuards({ unitPricePaise, mrpCapPaise, costPerBaseUnitPaise })` returning `ABOVE_MRP`, `BELOW_COST`, `COST_UNKNOWN` or ok.
- `allocateTenders(totalPaise, tenders)`, `changeDue(tenders)`.
- `checkCreditLimit({ limitPaise, balancePaise, creditPaise })`.
- `refundForReturnLine(originalLine, returnedQtyMilli)`.
- `openQuoteQuantities(quoteLines, convertedLines)`, `isQuoteExpired(validUntil, businessDate)`.
- `isSameBusinessDay(billBusinessDate, todayBusinessDate)`.
- `checkInterStateSale(...)`, `findSeriesGaps(lastSeq, seqsPresent)`.
- `buildUpiIntent({ vpa, payeeName, amountPaise, billNo })`: amount written as rupees with two decimals from integer paise, no floating point.

## State transitions

```
Bill version:  posted --cancel (reason + approval)--> cancelled
               posted --same-day edit--> (new version posted; old stays posted, no longer current)
Tender (UPI):  pending_confirmation --reference--> confirmed
               pending_confirmation --other payment--> replaced
Quotation:     open --convert all--> fully converted (derived)
               open --valid_until passes--> expired (derived; still convertible with a price choice)
Approval (005): requested -> approved | rejected | expired; approved -> consumed by one save
```

## Indexes

- `bill(shop_id, bill_no, version_no)` unique; `bill(previous_version_id)` unique; `bill(party_id, business_date)`.
- `bill_tender(business_id, reference) where mode = 'upi' and reference is not null` unique; `bill_tender(status)`.
- `sales_return_line(bill_line_id)`; `sales_return(bill_id)`.
- `quotation(shop_id, quotation_no, version_no)` unique; `bill_line(quotation_line_id)`.
- `held_bill(counter_code)`; `unmet_demand(recorded_at)`.
