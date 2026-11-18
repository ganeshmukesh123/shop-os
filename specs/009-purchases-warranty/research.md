# Research: Purchases, Distributors and Warranty Claims

**Feature**: `specs/009-purchases-warranty/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD section 9 (FR-PUR-001 to 015) and its warranty flow note, FR-ITM-014, FR-CMP-012, EC-08, EC-21, EC-22, the architecture reference sections 6.7 (compliance records), 7.7, 8.2 and 11.4, the constitution v2.1.0, and the plans of 002 (`item_batch`, `purchase_price_paise`, conversions, `is_serial_tracked`, `warranty_months`), 003 (below-cost guard reads batch cost), 004 (distributor parties, ledger, allocation, `payment.direction`), 005 (approvals, audit, cash) and 007 (locations, `MovementService`).

**Release**: the PRD tags FR-PUR-001 to 008 as V2; this spec is their own spec, so they are in scope (constitution VII). Build window 4 October to 7 November 2027 (002 research D16).

**Scope**: US1 to US4 and FR-016. Of US5, only FR-010's **data** (the warranty register, "data from MVP"); warranty cases, claim profiles, the claim pipeline and claim accounting (FR-011 to FR-014, V3), schemes (FR-009, V3) and purchase orders (FR-015, Later) are **not planned**. The licence meter on receipt (EC-21) depends on 007's V2 meter and is not planned.

## Decisions

### D1. Receipt and purchase bill are separate documents

- **Decision**: a `purchase_receipt` records what arrived (distributor, the distributor's invoice number and date if on the delivery, location, lines, charges); a `purchase_bill` records what the distributor billed and links to one or more receipts through `purchase_bill_receipt` (architecture 11.4: "a mismatch between what arrived and what was billed is visible instead of hidden").
- A receipt is a **draft** while the helper enters it (editable, nothing moves) and **posted** when confirmed: then stock moves, batches and price history are written, and the receipt and its lines become append-only. A posted receipt is corrected by a purchase return or a stock adjustment, never edited (spec edge case).
- **Liability**: the distributor ledger gets the amount when the **purchase bill** is posted, not at receipt. Receipts with no bill yet are listed as "Received, not billed" with their value.

### D2. Line quantities: invoiced, received, damaged

Each line stores `invoiced_qty_milli`, `received_qty_milli` and `damaged_qty_milli` (in base units after 002's conversion of the entered unit). Short = invoiced minus received when positive; excess = received minus invoiced when positive. Good = received minus damaged.

- Stock: one `purchase` movement of the good quantity into the receipt's location, and one `purchase` movement of the damaged quantity into the Defective location (so damaged goods are visible and can be returned, D6). Short quantities move nothing; they feed the debit note and the short-supply rate.
- **Example**: invoiced 100, received 98, damaged 3: 95 into Godown, 3 into Defective, short 2.

### D3. Landed cost by the architecture's allocation

- Charges (`freight`, `unloading`, `cartage`, `other`) are spread by value (default) or quantity per charge (FR-002). Share = charge x line basis / total basis, rounded down; the remainder goes to the line with the largest basis, so shares add up exactly (architecture 11.4).
- Line landed total = line value (received quantity x unit price) + shares. Landed cost per base unit = line landed total x 1000 / received quantity in milli, rounded half up, stored on the batch (`item_batch.landed_cost_paise`, 002) and in price history.
- **Example**: lines ₹6,000, ₹3,000 and ₹1,000 with ₹600 freight by value: shares ₹360, ₹180, ₹60.
- **Item cost**: `item_variant.purchase_price_paise` becomes the latest landed cost per base unit (what the below-cost guard uses when no batch is chosen, 003). Weighted-average cost for margin reports is feature 011's choice from the same price history.

### D4. Purchase GST per line (FR-016, FR-CMP-012)

Receipt lines store `gst_rate_bp` and `gst_paise` as printed on the distributor's invoice (entered or calculated from the rate), and the purchase bill stores the invoice's taxable value, CGST, SGST, IGST and total. A mismatch between the bill's total and the linked receipt lines is shown, not hidden. This is what 008's closing-stock statement reads for input credit; the claim itself is the CA's.

### D5. Distributor ledger on 004's ledger

- Distributors are 004 parties of type `distributor`. The same `party_ledger_entry` table is used with the 004 sign rule (positive = party owes the shop), so a purchase bill is a **negative** entry (the shop owes). New entry types: `purchase_bill`, `debit_note`, `payment_out`, `payment_out_reverse`. 004's `payment` gets `direction = 'out'`; allocations link payments out to purchase bills oldest first, and 004's ageing works on payables with the sign flipped.
- Due date = bill date + the distributor's credit days (004 `party.credit_days`); "Due this week" lists open bills due in the next 7 days (FR-004).
- **Cash purchase without a GST bill** (FR-003): a purchase bill with `is_unbilled_cash = 1`, paid at once by a `payment_out` in cash, which writes a 005 `cash_entry` of kind `cash_purchase` (new). Flagged in the exceptions list and in 011's reports.
- A nightly check (SC-004) compares each distributor's payable with the ledger sum (004's `ledger.verify` covers it).

### D6. Purchase returns and debit notes

`purchase_return` (linked to a posted receipt; lines from any location, normally Defective) writes `purchase_return` movements out of stock and a `debit_note` (number from `number_series` `doc_kind` `debit_note`, `DN{counter}/{fy}/{seq5}`, at most 16 characters) with a `debit_note` ledger entry that reduces the payable, in one transaction (US4 scenario 1). Status history Raised, Sent, Accepted, Settled is an append-only `debit_note_event` table (each transition logged with user and time, scenario 2). Short quantities can be put on a debit note without a stock movement (nothing arrived).

### D7. Price history and alerts

- `item_price_history(variant_id, party_id, receipt_line_id, unit_price_paise, landed_cost_paise, received_on)`, append-only, written at posting.
- **Alert** when a line's unit price per base unit is more than the threshold (default 2%, a setting) above the **last price from the same distributor** for that variant (FR-005); with no earlier price from that distributor, the last price from any distributor is used. The alert is an `exception_event` of kind `price_rise` and shows on the posting screen.
- **Suggested selling price** = landed cost / (1 - target margin), rounded up to the next rupee, where the target margin is a per-category setting (002 `category`, new `target_margin_bp`; spec assumption). The owner accepts, edits or ignores it; accepting uses 002's price commands (audited).
- **Example**: landed cost ₹84.00, target margin 20%: ₹84.00 / 0.8 = ₹105.00.

### D8. Distributor comparison (FR-006)

Per item and distributor: last price and date, average price over the last 6 receipts, average delivery days and short-supply rate. **Delivery days** need an order date; without purchase orders (FR-015, Later) the proxy is receipt date minus the distributor's invoice date (OI-1). **Roll variance** comes with V2 rolls (007); the column shows "No rolls yet".

### D9. ISI and BIS numbers (FR-008)

`compliance_record(scheme_code, identifier, variant_id, batch_id, valid_to)` (architecture 6.7), captured on the receipt line for items whose category is flagged `requires_isi` (new category column; seeded flags are unverified, and the spec says the BIS list "is maintained by the product, not the shop"). Missing number: a warning on the line and an `exception_event`, never a block. Identifier patterns are checked as warnings only (architecture 6.7).

### D10. Warranty register data now, cases and claims later

- **Decision**: `warranty_register` is a projection with one row per sold unit of a variant that carries `warranty_months` (002): bill line, sale date, party, serial number or batch, end date (sale business date + months). It is written in the bill transaction and rebuildable from bill lines.
- **Serial numbers**: for variants with `is_serial_tracked = 1`, the serial must be captured on the bill line at sale. 003's bill line has no serial field. This feature adds `bill_line_serial(bill_line_id, serial_no)` (append-only) and a serial prompt at the counter. Because the PRD wants warranty data "from MVP", the owner may pull this one task forward into 003 (OD-1).
- Cases, replacements, claim profiles, claims and claim accounting are V3 (not planned).

## Open items

| ID   | Item                                                                                              | Resolve by                               | Milestone |
| ---- | ------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------- |
| OI-1 | Delivery days without purchase orders: receipt date minus distributor invoice date as a proxy     | Owner accepts                            | M4        |
| OI-2 | Which categories need ISI or BIS numbers today (BIS QCO list)                                     | BIS website plus the CA or a distributor | M2        |
| OI-3 | Target margin per category                                                                        | Owner                                    | M4        |
| OI-4 | Whether distributors' invoice GST can be trusted as entered, or must be recomputed (input credit) | CA                                       | M3        |

## Owner decisions needed

| ID   | Question                                                                                | Recommendation                                                 | Needed by         |
| ---- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------- |
| OD-1 | Capture serial numbers at sale from go-live (move the `bill_line_serial` task into 003) | Yes: warranty data is "from MVP" and cannot be recovered later | Before 003 starts |

## References

- Architecture reference sections 6.7, 7.7 and 11.4 (`docs/reference/architecture.md`).
- Bureau of Indian Standards, Quality Control Orders list: https://www.bis.gov.in/ (primary; OI-2 because the list changes).
- CGST Act 2017, section 16 (input tax credit conditions): https://cbic-gst.gov.in/ (primary; the claim is the CA's).
- Largest-remainder allocation (Hamilton method) for exact integer shares: standard method; summary at https://en.wikipedia.org/wiki/Largest_remainder_method (secondhand summary).
- Industry practice: SAP and Odoo separate goods receipt from vendor bill and match them (three-way match with the purchase order) (https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/purchase/manage_deals/control_bills.html, primary vendor documentation). Odoo's landed costs split charges by value, quantity, weight or volume (https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/inventory/product_management/inventory_valuation/landed_costs.html, primary vendor documentation). D1 and D3 follow the same shape without purchase orders.
