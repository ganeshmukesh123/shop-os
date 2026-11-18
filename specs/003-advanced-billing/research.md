# Research: Advanced Counter Billing

**Feature**: `specs/003-advanced-billing/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD section 6 (FR-BIL-001 to 025), the PRD permissions table, the architecture reference sections 5.3, 5.4, 7.5, 8.3, 8.5, 10.4, 11.1 and 11.2, the constitution v2.1.0 (principle I as amended in v2.0.0), feature 001's design and feature 002's plan (variants, conversions, tiers, batches, tinted lines; branch `docs/002-plan`).

**Build order**: this feature is built after 005 (roles, approvals, audit log) and 004 (parties, ledger), as set in 002 research D16. It uses their tables through ports (`ApprovalPort`, `AuditPort`, `PartyLedgerPort`) so the services can be tested with fakes before 004 and 005 land.

## Decisions

### D1. Bill versions are new bill rows that share the number

- **Decision**: A same-day edit (FR-014) inserts a **new `bill` row** with the same `bill_no`, `version_no` one higher, `previous_version_id` pointing at the version it replaces, its own lines, tenders and movements. `UNIQUE(shop_id, bill_no)` becomes `UNIQUE(shop_id, bill_no, version_no)`. The current version is the one no later version points at. Version 1 is never touched, so the 001 immutability triggers stay as they are.
- **Stock and ledger**: the edit writes `edit_reverse` movements (the exact reverse of version 1's `sale` movements, doc = version 1) and new `sale` movements for version 2 (doc = version 2), all in one transaction with the new bill row and the audit entry (005). Ledger entries for a credit part follow the same pattern (feature 004 entry type `bill_edit_reverse`).
- **Example**: bill C1/26-27/000123 version 1 is 2 pcs x ₹120 = ₹240. The edit to 3 pcs saves version 2 (₹360) with the same number; stock gets +2 (`edit_reverse`) and -3 (`sale`); the audit log records who, when and why.
- **Alternatives considered**:

| Option                                                                                                       | Why rejected                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `bill_revision` table holding a JSON snapshot of the old version, header updated in place (architecture 7.5) | Updates a saved bill row, which constitution I (v2.0.0) forbids: "No version is ever overwritten" |
| New bill number for the edit, old bill cancelled                                                             | Spec scenario requires the number to be kept                                                      |
| Version number on lines only                                                                                 | A version's totals and tenders change too; they would need updating                               |

- The architecture says "a posted bill is never edited" (11.2); this design matches it, because nothing is edited. Recorded as a dated note to make in the architecture (task in Polish).

### D2. Price resolution order

`resolveUnitPrice` in `@shopos/core` takes the first match: party-specific price (feature 004 `party_price`), the party's tier price (002 `item_price`), the variant's Retail price. All prices are per base unit. Changing the customer or tier reprices every line that the user has not priced by hand; hand-priced lines keep their price and show "Manual price". Example: Retail ₹120, Contractor ₹110, party price ₹105 for Sharma Builders: Sharma gets ₹105, another contractor ₹110, a walk-in ₹120.

### D3. Discounts: basis points, a limit per user, approval above it

- Percent discounts are held in basis points and converted to paise once (001 rounding). A line discount and a bill discount are both checked against the user's discount limit (feature 005 `role.discount_limit_bp`, PRD defaults Manager 10%, Counter 3%).
- The limit compares the **effective discount** (line discounts plus bill discount, as a share of the lines' gross) with the limit, so splitting a discount across lines cannot bypass it.
- The bill discount is spread across lines in proportion to line amount; the last line takes the remainder so the parts add up exactly (architecture 11.1 step 4). Each line stores `bill_discount_share_paise`, which returns and GST (008) use. Example: ₹100 bill discount on lines of ₹600 and ₹400 gives shares of ₹60 and ₹40.
- Above the limit the screen asks for an approval (D5).

### D4. MRP cap and below-cost check

- **MRP**: billing picks the oldest batch with stock (002 `item_batch`, by `received_at`); staff can switch batch. The line stores `batch_id` and `mrp_cap_paise`. 003 adds `mrp_pack_qty_milli` to `item_batch` (default 1000, one base unit) because an MRP can be per coil or per box: the cap per base unit = `mrp_paise x 1000 / mrp_pack_qty_milli`, rounded down. A line above the cap is blocked with "Above MRP ₹450.00". CHECK `unit_price_paise <= mrp_cap_paise` on `bill_line` (architecture 8.3).
- **Below cost**: cost per base unit is the batch's `landed_cost_paise`, else the variant's `purchase_price_paise` (002). Below it, an approval is needed; with no cost, the check is skipped and the line shows "Cost unknown" (spec US2 scenario 3).
- Variants with no batch have no cap (most hardware items carry no MRP). The data-quality report for missing MRP on packaged goods belongs to 008 and 011.

### D5. Approvals at the counter use feature 005

- An approval request (005 `approval_request`) is single-use and bound to one subject: the draft bill's `client_bill_id`, the kind (`below_cost`, `over_discount`, `over_credit`, `cancel`, `return_without_bill`, `tinted_return`) and the exact amount. It is consumed when the bill saves. A changed amount needs a new request (architecture 11.2).
- At the counter the owner (or a delegated manager) enters their PIN; remote approval on the phone is feature 010. The request expires after 2 minutes for counter lines (spec US2 scenario 2): on reject or timeout the line reverts to the last allowed price.
- The bill stores the approval ids on the line (`approval_id`) or the bill (`approval_ids` for bill-level ones) so SC-005 ("100% show an approval record") is a query.

### D6. Tenders: split, pending UPI, confirmation as new rows

- `bill_tender.status` widens from `label` to `settled` (cash, card, credit), `pending_confirmation` (UPI) and keeps `label` for 001 bills. `reference` is new. A cash tender stores `tendered_paise` (what the customer handed over) so the bill shows change due; the tender `amount_paise` is the bill's share. Sum of tender amounts = bill total (checked in the service and by a test).
- **Confirmation without editing a saved row**: `tender_resolution` (append-only) records `confirmed` (with the bank or soundbox reference) or `replaced` (the customer paid another way: new mode and amount). A pending UPI tender's status shown on screens is derived: pending, confirmed or replaced. A partial unique index on `(business_id, reference)` for UPI rejects the same reference twice (fake-screenshot guard, architecture 8.3).
- **Credit tender**: writes a ledger entry for the party in the bill transaction (feature 004). Credit needs a party; over the limit (limit ₹50,000, balance ₹45,000, bill ₹8,000) needs approval.
- **Day close and Today card**: pending UPI tenders are listed by feature 005's day-close and 010's Today card; this feature provides the query `tenders.pendingUpi`.

### D7. UPI QR with the exact amount

- **Decision**: a UPI intent link `upi://pay?pa=<shop VPA>&pn=<shop name>&am=<amount in rupees with 2 decimals>&cu=INR&tn=<bill number>` rendered as a QR code on screen. The shop's VPA and payee name are settings.
- **Conflict noted**: 001 and the PRD say "UPI QR from the bank" (buy, don't build). A bank's printed static QR cannot carry the amount; FR-BIL-011 asks for "a QR with the exact amount". The link format is NPCI's published UPI linking specification, so this is a format, not a payment integration. Confirmation stays manual (reference entered by staff).
- **Open decision OD-1**: QR rendering needs a QR encoder. Options: the `qrcode` package (MIT, widely used, no native code) or writing an encoder (Reed-Solomon and masking; several hundred lines). Recommendation: the package, because a wrong QR takes a customer's money to the wrong place and a mature encoder is the safer choice. Needs owner approval (CLAUDE.md).
- **Open item OI-1**: confirm with the shop's bank that its merchant VPA accepts amount-bearing intent QR codes from a third-party screen (some merchant accounts restrict this). Resolve before M3.

### D8. Held bills

`held_bill(counter_code, payload JSON, held_at, label)`; at most 10 per counter (`HELD_LIMIT_REACHED` with the reason "A counter can hold at most 10 bills"). Recalling deletes the held row and loads it as the current draft. Held bills are drafts, not financial records, so deleting is allowed. They are backed up with the database.

### D9. Returns and credit notes

- **Documents**: `sales_return` (number from its own series, `R1/26-27/000012`, at most 16 characters), `sales_return_line` (original `bill_line_id`, `qty_base_milli`, refund amount), and `credit_note` when the refund goes to the party's account. All append-only.
- **Refund amount**: the original line's net price per base unit (amount minus line discount minus its bill-discount share, over quantity), times the returned quantity, rounded half up once. A partial return of 2 of 5 pieces bought at ₹110 after a ₹10 share each refunds ₹200. The current tier or price never matters (EC-11, spec edge case "return after tier price changed").
- **Limits**: returned quantity per bill line cannot exceed sold minus already returned (`RETURN_EXCEEDS_SOLD`). A line on a bill with a later version returns against the current version.
- **Stock**: one `sale_return` movement per line into the chosen location: the shop floor (sellable) or a seeded `defective` location. Tinted lines (002 `is_returnable = 0`) need a `tinted_return` approval and go to the `tinted_returns` location; the value written down is entered by the owner and recorded on the return line (`write_down_paise`).
- **Refund modes**: cash or UPI (a refund tender, negative direction, on the return) or credit note (ledger entry reducing the party balance, feature 004).
- **No bill**: allowed only with a `return_without_bill` approval; the return line then names the variant and a price typed by staff. CHECK on `sales_return`: `bill_id is not null or approval_id is not null` (architecture 8.3).
- **Find the bill**: by number, by party phone (004), or by scanning the printed QR. 003 prints a QR on the bill holding `shopos:bill:<bill id>` (an id, not personal data); the printed layout contract is updated.
- **Kits**: EC-12 (prorated kit returns) needs kits, which are V2 (002 FR-018). Not planned here; noted for the kits spec.

### D10. Quotations

- `quotation` (number `Q1/26-27/000045` from its own series, `version_no`, `previous_version_id`, `valid_until` business date, default issue date + 7 days, party or customer name, totals) and `quotation_line`. A revision is a new row with the same number and the next version, exactly like bills (D1), so earlier versions stay viewable.
- **Conversion**: a bill made from a quote stores `quotation_id`, and each bill line stores `quotation_line_id`. Open quantity per quote line = quoted minus the sum converted (derived, never stored). Prices: inside validity they stay; after `valid_until` the screen offers "Keep quoted prices" or "Refresh to today's prices". Quoted prices still pass the MRP cap and cost checks at conversion.
- **Share**: a PDF of the quote plus a WhatsApp link `https://wa.me/<phone>?text=<message>` opened in the system browser. A WhatsApp link cannot attach a file, so the message names the quote and the PDF is saved for the user to attach (buy, don't build). Opening external links must pass 018's navigation policy (`shell.openExternal` allow-list gains `https://wa.me/`).
- Quotes do not move stock or ledger.

### D11. Same-day edit and cancel rules

- Edit allowed when the bill's `business_date` equals today's business date in the shop's time zone (001 D22) and the user's role has `bill.edit` (005). Otherwise `EDIT_NOT_SAME_DAY` and the screen offers a return or credit note (EC-18).
- Cancel needs a reason and a `cancel` approval (005), keeps the number, and is listed in the exceptions report (005 and 011 read `bill.status`). Cancelling a bill with several versions cancels the current version and reverses its movements (002 changed cancel to reverse every `sale` movement; versions add `edit_reverse` to the list it reads).
- A version cannot be edited after the bill is cancelled, and a cancelled bill cannot be edited (`BILL_CANCELLED`).

### D12. Unmet demand

`unmet_demand(text, variant_id nullable, party_id nullable, recorded_at, counter_code)`, one tap from the "No match" row of the search box. Reports are feature 011; 007's reorder suggestions may read it later.

### D13. Customer rules

- Customer is optional for a cash sale; required when a tender is credit, the tier is not Retail, or a line's variant is warranty-tracked (002 `warranty_months` or `is_serial_tracked`). Quick-add creates a party (004) with name, phone and a consent tick; consent is recorded by 004's `consent_record`.
- The bill gains `party_id` (nullable) beside 001's `customer_name`; the name snapshot stays for printing.
- If a customer withdraws consent mid-bill, the bill still saves and prints (spec edge case): the bill is a transactional record kept for the legal period (001 D19).

### D14. Inter-state check (shared with 008)

`checkInterStateSale({ registrationType, homeStateCode, placeOfSupplyStateCode })` in `@shopos/core` returns `INTER_STATE_UNDER_COMPOSITION` when the shop is under composition and the place of supply differs. 003 adds `shop_profile.home_state_code` (two-digit GST state code) and `bill.place_of_supply_state` (default the home state; changed when a delivery address in another state is set, feature 006). The registration type and dated switch are feature 008; until 008, the registration type is a setting with `composition` as default.

### D15. Keyboard shortcuts

One shortcut table in `apps/desktop/src/renderer/features/billing/shortcuts.ts`, listed in `contracts/keyboard-shortcuts.md`. Function keys avoid clashes with typing in the search box. The shortcut help opens with `F1`.

### D16. Bill number gaps (EC-19)

Numbers are taken inside the bill transaction (001), so a crash cannot leave a gap on its own. A start-up check (`findSeriesGaps` in core) compares each series' `last_seq` with the bills present; any gap found is written to `bill_number_gap` with reason `device_crash` and shown in the bill list like 001's `lost_in_restore` gaps.

## Open items

| ID   | Item                                                                                                                         | Resolve by           | Milestone |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------- |
| OI-1 | Bank accepts amount-bearing UPI intent QR for the shop's merchant VPA                                                        | Shop's bank          | M3        |
| OI-2 | Whether WhatsApp share of the bill PDF is acceptable as "share" for the owner (link plus saved PDF, no automatic attachment) | Owner                | M2        |
| OI-3 | Printed QR on the bill: allowed on a Bill of Supply and a tax invoice without changing their mandatory content               | Shop's CA (with 008) | M4        |
| OI-4 | Discount limits per role (PRD defaults are examples)                                                                         | Owner (005 settings) | M3        |

## Owner decisions needed

| ID   | Question                                | Recommendation | Needed by |
| ---- | --------------------------------------- | -------------- | --------- |
| OD-1 | Add the `qrcode` package for the UPI QR | Yes (D7)       | M3        |

## References

- NPCI, UPI Linking Specifications (deep-link and QR parameters `pa`, `pn`, `am`, `cu`, `tn`), version 1.6: https://www.npci.org.in/ (primary; the PDF is under UPI product documents).
- WhatsApp "click to chat" links: https://faq.whatsapp.com/5913398998672934 (primary vendor documentation).
- Electron `shell.openExternal` security guidance: https://www.electronjs.org/docs/latest/tutorial/security#15-do-not-use-shellopenexternal-with-untrusted-content (primary).
- Architecture reference sections 5.3, 8.3, 8.5, 11.1, 11.2 (`docs/reference/architecture.md`).
- Industry practice: Square Point of Sale records split tenders as separate tender objects on one order and refunds as separate refund objects linked to the original payment (https://developer.squareup.com/docs/payments-api/refund-payments, primary vendor documentation). Shopify POS processes returns against the original order and refunds at the price paid, not the current price (https://help.shopify.com/en/manual/sell-in-person/shopify-pos/order-management/refunds-and-exchanges, primary vendor documentation). Both match D6 and D9. No reliable public practice was found for keeping a bill number across edited versions; D1 follows the constitution.
