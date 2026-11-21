# Research: GST, Bill Formats and Compliance

**Feature**: `specs/008-gst-compliance/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD section 11 (FR-CMP-001 to 017), FR-BIL-014, FR-BIL-022, EC-15 to EC-17, EC-19, the architecture reference sections 6.7 (tax), 8.3 (checks), 8.5 (bill DDL), 11.1 (pricing and tax steps) and 11.9 (registration change), the constitution v2.1.0 ("Compliance is data, confirmed by a professional"), 001 research D19 to D23 (erasure, tax-inclusive prices and rounding, numbering after restore, time zone, document title), and the plans of 002 (HSN on items), 003 (discount shares, inter-state check, gap check, bill versions) and 004 (party GSTIN, `consent_record`).

**Every legal point below is a default to confirm with the shop's CA or counsel.** The spec's assumptions say the bill-number and header rules were found in secondary summaries only; nothing here upgrades that. Open items list each.

**Build order and the DPDP date**: 002 research D16 puts this feature at 7 June to 4 July 2027. The DPDP consent duties start on 13 May 2027 (PRD, constitution). So the consent part (US5 scenarios 2 to 4) is split out as milestone **M0, 3 to 12 May 2027**, built on 004's `consent_record`, during 003's window. Owner decision OD-1 confirms the split.

## Decisions

### D1. Registration is a dated setting per shop; the bill stores what applied

- **Decision**: `registration_setting(shop_id, registration_type, gstin, legal_name, effective_from_ms, home_state_code)`, append-only rows; the one in force at a bill's `billed_at` is the latest eligible row with `effective_from_ms <= billed_at` (exclude cancelled switches as defined in the data model). An effective instant, not just a date, handles a switch in the middle of a day (spec edge case). Each bill version stores `doc_format` (`bill_of_supply`, `tax_invoice`), `registration_type`, both GSTINs and the printed shop and recipient names and addresses as snapshots, so a past bill reprints exactly (FR-002, architecture 11.9).
- **Before any registration is in force** (the 001 trial) bills keep the `Estimate` title (001 D23). Once a registration exists, the title comes from the format: "Bill of Supply" or "Tax Invoice"; the free `doc_title` setting is no longer used for new bills.

### D2. Tax is calculated from tax-inclusive prices, line by line

- **Decision** (001 D20, architecture 11.1 step 7): prices are final, tax-inclusive. For each line, net = `amount_paise` minus the line's bill-discount share (003). `amount_paise` already excludes the line discount (001 data model: quantity x price, rounded, minus the line discount), so the line discount is not subtracted again. Example: 1 pipe at ₹1,180.00 with ₹118.00 off has `amount_paise` ₹1,062.00; with no bill discount the net is ₹1,062.00, taxable ₹900.00 at 18%. Under a tax invoice: taxable = net x 10000 / (10000 + rate_bp), rounded half up once; tax = net minus taxable; intra-state: CGST = tax / 2 rounded down, SGST = tax minus CGST (the odd paisa goes to SGST); inter-state: IGST = tax. So taxable + CGST + SGST + IGST = net exactly for every line, and the bill total = sum of lines + round-off (the architecture's CHECK).
- **Example**: net ₹1,180.00 at 18%: taxable ₹1,000.00, tax ₹180.00, CGST ₹90.00, SGST ₹90.00. Net ₹100.01 at 18%: taxable 10001 x 10000 / 11800 = 8475.42, rounded to ₹84.75; tax ₹15.26; CGST ₹7.63, SGST ₹7.63.
- **Under composition**: no tax is calculated or shown (FR-001); the line still stores HSN and rate for later reports.
- **Open item OI-1**: whether the CA prefers CGST and SGST each computed as rate/2 on the taxable value (which can differ from the net by a paisa) instead of the split above. The split keeps the printed total equal to the price the customer agreed.
- **Tax-extra pricing** (architecture 11.1 assumption) is not built: 001 D20 says prices are tax-inclusive.

### D3. Dated rates: HSN table plus a dated item override

- **Decision**: `hsn_rate(hsn_prefix, rate_bp, effective_from, effective_to)`: the rate for an item on a business date is the row whose prefix is the longest match of the item's HSN (variant, else family, else category, 002) and whose date range contains the date. `item_tax_override(variant_id, rate_bp, effective_from)` covers the few exceptions (architecture 6.7). A rate change is a new row with a future date; old bills keep their stored rate.
- **Seed**: the architecture's research says 18% across the basket from 22 September 2025, with LED lamps (8539) and luminaires (9405) at 12% before that date, and a few items at 5%. Seeded rows are marked `verified = 0` until the CA confirms them (OI-2), and the golden test for the LED case is kept.
- **Missing HSN or rate** under a tax invoice: the bill is not blocked at the counter (constitution IV spirit: never stop a sale for data); the line uses the category default, else 18%, and an `exception_event` of kind `missing_hsn` is raised for the owner. The switch wizard (D7) refuses to finish while any active item lacks an HSN (spec edge case).

### D4. Bill formats and mandatory fields

The printed content per format is in `contracts/bill-formats.md`, drawn from CGST Rule 46 (tax invoice) and Rule 49 (bill of supply) as summarised by secondary sources; each field is an item for the CA to confirm (OI-3). The composition declaration text is the PRD's: "composition taxable person, not eligible to collect tax on supplies" (FR-001).

### D5. Number series per format

`number_series` (001) gains format and registration ID in its key (see the data model). Each switch starts a distinct series at its effective instant and reserves a prefix before restarting at 1. For example, in the same financial year use `C1/27-28/000001`, then `I1/27-28/000001`, then `C2/27-28/000001` for a return to composition. Do not use `T`, which 012 reserves for training; every template is checked to stay within 16 characters of letters, digits, hyphen and slash (001 numbering). Gaps from crashes and restores are already recorded (001 D21, 003 D16); a 10,000-bill test checks no repeats and no number above 16 characters (SC-005).

### D6. Turnover tracker

- `turnover_daily(business_date, sales_paise, returns_paise)` projection, updated in the bill and return transactions and rebuildable. Financial-year turnover = sum of current-version, non-cancelled bill totals minus sales returns (OI-4: the CA confirms what "aggregate turnover" includes, for example exempt supplies and interest).
- Limit setting default ₹1,50,00,000, with ₹75,00,000 selectable for special-category states (FR-003). Warnings at 80% and 95% on the home screen and day close; crossing raises an `exception_event` and a banner from the crossing date that links to the switch wizard and says "Talk to your CA" (EC-15). Nothing is switched automatically.

### D7. Scheme-switch wizard

Steps recorded on a `scheme_switch` row (`draft`, `checklist_ok`, `confirmed`, `effective`, or `cancelled`):

1. Target type and effective date and time (future, in the shop's zone).
2. Checklist: every active item has an HSN and a resolvable rate; business parties with GSTIN entered; a new series template within 16 characters. The wizard cannot be confirmed until the list is clear (architecture 11.9).

3. Generate or refresh the final closing-stock statement when the switch takes effect. Use movements with `occurred_at < effective_from_ms` (strictly before: a movement at the switch instant belongs to the new scheme, as registration selection assigns it) and exclude later activity, even if the report is generated after that instant. The final statement is read in one read transaction that starts after `effective_from_ms`; the app has a single SQLite writer, so every local movement stamped before the instant has committed by then. A movement synced later from another device (010) with an earlier `occurred_at` marks the statement stale and it is regenerated; it becomes final only when no device has unsynced movements before the cutoff. Show per-variant quantity (from movements), cost, and purchase tax where recorded. Any statement shown earlier is a preview; confirmation does not set the cutoff. Purchase GST per line is FR-CMP-012 (V2, feature 009), so until 009 the statement shows "Purchase tax not recorded" for those lines and is a CA working paper, not a claim.
4. Suggested prices: for composition to regular, the owner chooses "keep final price" (tax comes out of margin) or "add GST on top of today's price"; suggestions are rounded to the rupee and can be edited one by one before applying. Schedule the audited changes through 002's price path with effect at `effective_from_ms`. Billing uses the current scheme and prices until then. Scheduled changes from a cancelled switch never take effect.
5. Confirm with the CA (a tick and the CA's name are recorded); confirmation writes the linked `registration_setting`, its new series and the audited price schedule for the same effective instant in one transaction.

- Moving regular to composition produces the reversal statement in the same way.

### D8. DPDP consent, notice, withdrawal, requests (milestone M0)

- **Notice**: `privacy_notice(version, language, body, published_at)`; the counter shows the current notice in plain language when a party is created (004's quick-add and party form) with a tick for transactional processing and a separate tick for marketing; each tick writes a 004 `consent_record` with the notice version (FR-005).
- **Withdrawal** from the party page writes a new `consent_record`; marketing stops at once (nothing in the MVP sends marketing yet, so the effect is that future marketing features must read the latest record); transactional statements and bills continue (EC-17).
- **Requests**: `data_request(party_id, kind, received_at, due_at, status, completed_at, note)`; kinds `access`, `correction`, `erasure`, `grievance`. Access produces an export (JSON and a readable PDF) of the party record, consents, ledger and bill list. Erasure blanks the party's phones, address, area, pin, GSTIN and notes and replaces the name with "Erased customer" plus a short id; consents are kept as evidence; bills keep exactly what was printed (001 D19). If the party still owes money, the erasure is recorded as "deferred: outstanding balance" for counsel to advise (OI-5).
- **Due dates** for responses and the breach-notice duty (NFR-009: inform within 72 hours) come from the DPDP Rules 2025; the exact periods are an item for counsel (OI-6). The app only tracks dates.

### D9. Records retention

No command deletes a bill, line, tender, ledger entry or movement; triggers reject deletes (001 to 007). FR-006's "at least 72 months from the annual return due date" is met by keeping everything; a retention note in the restore guide explains this. Archiving very old data is not built.

### D10. What is not planned

V2 and V3 items: CA exports for CMP-08 and GSTR-4 (in 011), measuring-instrument reminders, purchase GST per line (009), GSTR-1 and GSTR-3B exports, the GST simulator (constitution VII). The MRP cap (FR-004) is built in 003; the inter-state rule (FR-010) uses 003's `checkInterStateSale` with the registration from D1; party GSTIN (FR-011) is 004's field, printed here.

## Open items (to confirm with the CA or counsel before go-live)

| ID   | Item                                                                                                                                                           | Who     | Milestone |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------- |
| OI-1 | CGST and SGST split method and rounding per line                                                                                                               | CA      | M1        |
| OI-2 | Seeded HSN rates (18% basket, 12% LED before 22 Sep 2025, 5% items)                                                                                            | CA      | M2        |
| OI-3 | Mandatory fields of the tax invoice and bill of supply (Rules 46 and 49) and the exact composition declaration wording                                         | CA      | M2        |
| OI-4 | What counts in aggregate turnover for the composition limit; whether the shop's state has the ₹75 lakh limit                                                   | CA      | M3        |
| OI-5 | Erasure when the party owes money; whether a walk-in name must stay on a bill (001 D19)                                                                        | Counsel | M0        |
| OI-6 | DPDP response periods, breach notice duties and notice wording                                                                                                 | Counsel | M0        |
| OI-7 | Whether cancelled invoices and restore gaps need any report beyond the bill list (spec assumption)                                                             | CA      | M4        |
| OI-8 | Whether the shop profile (name, address) changed before 008; if so, reprints of older bills show the migration-time header (data-model, `legacy_print_header`) | Owner   | M1        |

## Owner decisions needed

| ID   | Question                                                                     | Recommendation                            | Needed by  |
| ---- | ---------------------------------------------------------------------------- | ----------------------------------------- | ---------- |
| OD-1 | Build the DPDP consent part as M0 (3 to 12 May 2027), before the rest of 008 | Yes, it has a legal start date            | April 2027 |
| OD-2 | Default price choice in the switch wizard                                    | Keep final price; owner reviews each item | M4         |

## References

- CGST Rules 2017, Rule 46 (tax invoice) and Rule 49 (bill of supply), CBIC: https://cbic-gst.gov.in/gst-acts.html (primary; the statute text itself has not been re-read in this session, hence OI-3).
- CGST Act 2017, section 10 (composition levy) and notifications on the turnover limit: https://cbic-gst.gov.in/ (primary).
- CBIC notification on GST rate changes effective 22 September 2025: https://cbic-gst.gov.in/gst-goods-services-rates.html (primary; not re-read here, hence OI-2).
- Digital Personal Data Protection Act 2023 and DPDP Rules 2025: https://www.meity.gov.in/data-protection-framework (primary).
- 001 research D19 to D23 (`specs/001-shop-os-mvp/research.md`).
- Industry practice: Tally and Zoho Books keep tax-inclusive pricing as an item-level option and back-calculate taxable value per line (vendor documentation: https://www.zoho.com/in/books/help/settings/taxes.html, primary vendor documentation). Indian POS systems commonly start a new invoice series per financial year and per document type (vendor documentation, secondhand). No primary source was found on how other products split an odd paisa between CGST and SGST; OI-1 stays open.
