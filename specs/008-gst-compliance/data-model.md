# Data Model: GST, Bill Formats and Compliance

Builds on 001 (bill, numbering), 002 (HSN on variant, family and category; `gst_rate_override_bp` reserved), 003 (bill versions, `bill_discount_share_paise`, `place_of_supply_state`, `home_state_code`), 004 (party GSTIN, `consent_record`) and 005 (audit). Conventions unchanged. Decisions in `research.md` D1 to D10.

## Overview

```
registration_setting (dated, per shop) --applies at billed_at--> bill.doc_format, registration_type
hsn_rate (prefix, dated) + item_tax_override (dated) --> bill_line.gst_rate_bp, taxable, cgst, sgst, igst
number_series (+ doc_format) 1--* bill
turnover_daily (projection)    scheme_switch (wizard state)
privacy_notice 1--* consent_record (004)    party 1--* data_request
```

## New tables

### `registration_setting` (append-only)

`registration_type` (`composition`, `regular`), `gstin` (15 characters), `legal_name` (1-100), `trade_name` (nullable), `home_state_code` (2 digits), `effective_from_ms`, `created_by`, `scheme_switch_id` (nullable). The row in force at an instant is the latest with `effective_from_ms <= instant`. A row with a future time can be superseded before it starts only by another row (a draft wizard is cancelled, never edited).

### `hsn_rate`

`hsn_prefix` (2 to 8 digits), `rate_bp` (0, 500, 1200, 1800, 2800 or other 0 to 10000), `effective_from` (`YYYY-MM-DD`), `effective_to` (nullable), `verified` (0 or 1), `source_ref`. Ranges for the same prefix must not overlap (service check and test).

### `item_tax_override`

`variant_id`, `rate_bp`, `effective_from`. Latest with `effective_from <= business_date` wins over `hsn_rate`.

### `turnover_daily` (projection)

`business_date` unique per shop, `sales_paise`, `returns_paise`. Updated in bill, cancel, edit and return transactions; rebuildable from documents.

### `scheme_switch`

`from_type`, `to_type`, `effective_from_ms`, `status` (`draft`, `checklist_ok`, `confirmed`, `effective`, `cancelled`), `checklist_json`, `new_series_template`, `ca_name`, `ca_confirmed_at`, `price_plan_json`, `closing_stock_report_path`, `created_by`. Moves only forward, or to `cancelled` before `effective`.

### `privacy_notice` (append-only)

`version` (integer), `language` (`en`, `hi`), `body` (up to 4,000 characters), `published_at`. `UNIQUE(version, language)`.

### `data_request`

`party_id`, `kind` (`access`, `correction`, `erasure`, `grievance`), `received_at`, `due_at`, `status` (`open`, `done`, `deferred`, `rejected`), `completed_at`, `note` (required for `deferred` and `rejected`), `export_path` (for `access`), `handled_by`.

## Changed tables

### `bill` (per version; append-only except cancel)

Adds `doc_format` (`estimate` for bills before any registration, `bill_of_supply`, `tax_invoice`), `registration_type` (nullable for estimates), `shop_gstin_snapshot`, `party_gstin_snapshot`, `taxable_paise`, `cgst_paise`, `sgst_paise`, `igst_paise` (all 0 for bills of supply and estimates). CHECKs (architecture 8.5): `total_paise = taxable_paise + cgst_paise + sgst_paise + igst_paise + round_off_paise` for tax invoices; `doc_format <> 'bill_of_supply' or (cgst_paise = 0 and sgst_paise = 0 and igst_paise = 0)`; `registration_type = 'regular' or igst_paise = 0`. For bills of supply and estimates `taxable_paise` equals the subtotal after discounts.

### `bill_line` (append-only)

Adds `hsn_code` (snapshot), `gst_rate_bp`, `taxable_paise`, `cgst_paise`, `sgst_paise`, `igst_paise`. CHECK for tax-invoice lines: `taxable + cgst + sgst + igst = amount_paise - line_discount_paise - bill_discount_share_paise`.

### `number_series`

Adds `doc_format`; unique per shop, counter, financial year, `doc_kind` and `doc_format`.

### `party` (004)

Erasure blanks `phone` rows (deleted from `party_phone`, which is master data, not a record), `address`, `area`, `pin_code`, `gstin`, `notes`, and sets `name` to "Erased customer <short id>" and `is_erased = 1` (new column). The erasure is audited.

### `shop_profile`

Adds `composition_limit_paise` (default 1500000000), `turnover_warn_bp` (default `[8000, 9500]`).

## Derived values (in `@shopos/core`)

- `registrationAt(settings, instantMs)`, `docFormatFor(registration)`.
- `resolveGstRate({ hsn, businessDate, hsnRates, overrides })` (longest prefix, dated).
- `taxLine({ netPaise, rateBp, isInterState })` returning taxable, CGST, SGST, IGST (research D2).
- `taxBill(lines, { docFormat, isInterState })` and the total identity check.
- `turnoverForYear(daily, financialYear)`, `turnoverAlert({ turnoverPaise, limitPaise, warnBp })`.
- `switchChecklist({ items, parties, seriesTemplate })`, `suggestPrice({ pricePaise, rateBp, choice })`.
- `closingStockStatement({ balances, costs, purchaseTax? })`.
- `eraseParty(party)` returning the blanked fields.

Example: net ₹1,180.00 at 18% intra-state gives taxable ₹1,000.00, CGST ₹90.00, SGST ₹90.00; the same inter-state gives IGST ₹180.00.

## Indexes

- `registration_setting(shop_id, effective_from_ms)`.
- `hsn_rate(hsn_prefix, effective_from)`; `item_tax_override(variant_id, effective_from)`.
- `turnover_daily(shop_id, business_date)` unique.
- `data_request(status, due_at)`.
