# Data Model: Purchases, Distributors and Warranty Register

Builds on 002 (`item_batch`, `purchase_price_paise`, conversions, `category`, warranty flags), 003 (bill lines), 004 (party, ledger, allocation, payment), 005 (audit, cash, approvals), 007 (locations, `MovementService`) and 008 (GST rates). Conventions unchanged. Decisions in `research.md` D1 to D10.

## Overview

```
party (distributor) 1--* purchase_receipt 1--* purchase_receipt_line --> item_batch, item_price_history
                           |  1--* purchase_receipt_charge                 compliance_record
                           *--* purchase_bill (via purchase_bill_receipt) --> party_ledger_entry (purchase_bill)
purchase_receipt 1--* purchase_return 1--* purchase_return_line
purchase_return 1--1 debit_note 1--* debit_note_event      debit_note --> party_ledger_entry (debit_note)
payment (direction out) --> party_ledger_entry (payment_out) --> ledger_allocation to purchase_bill entries
bill_line 1--* bill_line_serial     bill_line --> warranty_register (projection)
```

## New tables

### `purchase_receipt`

| Field                                            | Rule                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| receipt_no                                       | from `number_series` `doc_kind` `receipt_in` (`GR{counter}/{fy}/{seq5}`), at most 16 characters, set at posting            |
| party_id                                         | FK to a `distributor` party                                                                                                |
| supplier_invoice_no, supplier_invoice_date       | nullable text up to 30 and date; warning (not error) when the same distributor, number and financial year already exist    |
| location_id                                      | FK: where good stock goes (default Godown)                                                                                 |
| status                                           | `draft`, `posted`; only draft rows and their lines and charges may change; trigger blocks UPDATE and DELETE after `posted` |
| received_at, business_date, posted_by, posted_at |                                                                                                                            |
| client_receipt_id                                | unique per shop (idempotent posting)                                                                                       |

### `purchase_receipt_line`

| Field                                                     | Rule                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| receipt_id, line_no, variant_id                           |                                                                                             |
| entered_uom, invoiced_qty_entered_milli                   | as entered; base quantities by 002 conversion                                               |
| invoiced_qty_milli, received_qty_milli, damaged_qty_milli | base units; `damaged <= received`; all 0 or more                                            |
| unit_price_paise                                          | per base unit, 0 or more                                                                    |
| line_value_paise                                          | received x price / 1000, rounded half up once; 0 when received is 0                         |
| charges_share_paise                                       | from allocation; 0 when received is 0; sum over lines = sum of charges                      |
| landed_total_paise, landed_cost_paise                     | total and per base unit (research D3); when received is 0, total is 0 and unit cost is NULL |
| batch_code, mrp_paise, mrp_pack_qty_milli                 | nullable; batch created at posting only for received stock                                  |
| gst_rate_bp, gst_paise                                    | from the distributor's invoice                                                              |
| isi_number                                                | nullable; warning when the category requires it                                             |
| batch_id                                                  | set at posting for received stock; otherwise NULL                                           |

### `purchase_receipt_charge`

`receipt_id`, `kind` (`freight`, `unloading`, `cartage`, `other`), `amount_paise > 0`, `basis` (`value` default, `quantity`), `note`.

### `purchase_bill` (append-only)

`party_id`, `supplier_invoice_no` (1-30), `supplier_invoice_date`, `taxable_paise`, `cgst_paise`, `sgst_paise`, `igst_paise`, `total_paise` (CHECK total = taxable + taxes + round-off), `round_off_paise`, `due_date` (= invoice date + credit days), `is_unbilled_cash` (0 or 1), `business_date`, `client_bill_id` unique. `UNIQUE(party_id, supplier_invoice_no, financial_year)` except for unbilled cash.

### `purchase_bill_receipt` (append-only)

`purchase_bill_id`, `receipt_id`; a receipt is billed at most once (unique `receipt_id`). When the bill posts, allocate any unapplied credit on already-posted debit notes for its linked receipts to the new bill ledger entry in the same transaction, oldest note first (tie by ID), before allocating any payment posted with the bill. Each allocation is capped by both the note’s unapplied amount and the bill’s remaining open amount under 004’s absolute `ledger_allocation` bounds. Leave any excess credit unapplied. Open amount and ageing use the resulting allocations.

### `item_price_history` (append-only)

`variant_id`, `party_id`, `receipt_line_id`, `unit_price_paise`, `landed_cost_paise` (NULL when received quantity is zero), `received_on`.

### `purchase_return` and `purchase_return_line` (append-only)

`purchase_return`: `return_no` (`PR{counter}/{fy}/{seq5}`), `receipt_id`, `party_id`, `reason` (1-200), `business_date`. Lines: `receipt_line_id`, `variant_id`, `from_location_id`, `qty_base_milli` (0 for short-only lines), `short_qty_milli`, `value_paise` = returned `qty_base_milli` × the line's landed cost + `short_qty_milli` × the invoiced unit price (see D6). Short units never arrived, so they carry no freight or other charge share. Example: 2 invoiced at ₹100, 1 arrives, freight ₹100, so the received unit's landed cost is ₹200; returning it and claiming the short unit credits ₹200 + ₹100 = ₹300, what the goods and freight cost. In the posting transaction, check each receipt line across all posted returns plus every proposed return line: cumulative `qty_base_milli` must not exceed the original received quantity, and cumulative `short_qty_milli` must not exceed `max(0, invoiced_qty_milli - received_qty_milli)`. Include short-only return lines in the short-quantity check.

### `debit_note` and `debit_note_event` (append-only)

`debit_note`: `debit_note_no`, `return_id` unique, `party_id`, `amount_paise > 0`. `debit_note_event`: `debit_note_id`, `status` (`raised`, `sent`, `accepted`, `settled`), `note`, `user_id`, `occurred_at`; statuses only move forward one step (core rule, tested).

### `compliance_record`

`scheme_code` (`ISI_CML`, `BIS_R`), `identifier` (1-40), `variant_id`, `batch_id` (nullable), `valid_to` (nullable), `source` (`receipt`).

### `bill_line_serial` (append-only)

`bill_line_id`, `serial_no` (1-40); count per line equals the line's quantity in whole units for serial-tracked variants (service check). Never updated or deleted, also on cancel: the rows record what was sold, and a cancelled or superseded bill's serials are excluded by reading the bill's status and current version.

### `warranty_register` (projection)

`bill_line_id`, `variant_id`, `party_id` (nullable), `serial_no` or `batch_id`, `sold_on`, `ends_on` (= sale business date + the bill line’s `warranty_months_at_sale`, using the same end-of-month rule for incremental writes and rebuilds). A NULL snapshot yields no row. Rebuild uses saved sale data, including any captured serials, from the **current version** of each non-cancelled bill only. Cancellation removes the bill's register rows in its transaction. A same-day edit (003) removes the register rows of the version it replaces and writes rows for the new version's warranty lines in the edit transaction, so a line removed by the edit has no warranty and a rebuild cannot bring it back. The register is a projection, so deleting its rows is allowed; `bill_line_serial` rows are not touched.

## Changed tables

- 003 adds nullable integer `bill_line.warranty_months_at_sale` (NULL for a line without warranty). Save the applicable duration from 002 in the bill transaction and preserve it on the immutable bill line. Never infer missing historical snapshots from the current variant settings.

- Lookup rows only, no table rebuild (002 research D17; this feature runs after go-live, so every migration must be additive for 012's rollback rule): `movement_type` `purchase` (in, doc) and `purchase_return` (out, doc); `movement_doc_type` `purchase_receipt`, `purchase_return`; `ledger_entry_type` and `cash_entry_kind` rows below; `doc_kind` rows `receipt_in`, `purchase_return`, `debit_note`; `exception_kind` rows below.
- `party_ledger_entry.entry_type` adds `purchase_bill` (negative), `debit_note` (positive), `payment_out` (positive), `payment_out_reverse` (negative).
- `payment.direction` gets `out`; `ledger_allocation` links `payment_out` and `debit_note` entries (settling) to `purchase_bill` entries (settled) with 004's absolute bounds, so a negative purchase bill allocates like a positive customer bill.
- `cash_entry.kind` adds `cash_purchase` (negative).
- `category` adds `target_margin_bp` (nullable, 0 to 9000) and `requires_isi` (0 or 1, seeded unverified).
- `exception_event.kind` adds `price_rise`, `missing_isi`, `unbilled_cash_purchase`, `duplicate_supplier_invoice`.
- `number_series` uses the `doc_kind` rows above.

## Derived values (in `@shopos/core`)

- `allocateCharges(lines, charges)`: floor each proportional share, then distribute leftover paise one at a time by descending fractional remainder, breaking ties by ascending receipt line number (research D3; architecture 11.4).
- `landedCostPerBaseUnit(lineValuePaise, sharesPaise, receivedMilli)`: no unit cost when received is zero.
- `lineQuantities({ invoiced, received, damaged })` returning good, short, excess.
- `priceRiseAlert({ newPricePaise, lastPricePaise, thresholdBp })`.
- `suggestSellingPrice({ landedCostPaise, targetMarginBp })` rounded up to the rupee.
- `dueDate(invoiceDate, creditDays)`, `payablesDueThisWeek(openBills, today)`.
- `nextDebitNoteStatus(current)`.
- `warrantyEndDate(soldOn, months)`.

Example: lines ₹6,000, ₹3,000, ₹1,000 and ₹600 freight by value give shares ₹360, ₹180, ₹60; 100 units at ₹60 with ₹360 give a landed cost of ₹63.60 per unit.

## Indexes

- `purchase_receipt(party_id, supplier_invoice_no)`, `purchase_receipt(status, business_date)`.
- `purchase_receipt_line(receipt_id)`, `item_price_history(variant_id, party_id, received_on)`.
- `purchase_bill(party_id, due_date)`; `purchase_bill_receipt(receipt_id)` unique.
- `warranty_register(serial_no)`, `warranty_register(party_id)`; `bill_line_serial(serial_no)`.
