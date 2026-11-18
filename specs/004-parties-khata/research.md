# Research: Parties and Khata (Credit)

**Feature**: `specs/004-parties-khata/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD section 8 (FR-KHA-001 to 014), US-05, US-08, US-15, US-16, EC-06, EC-14, EC-17, BO-2, the architecture reference sections 7.4, 8.1, 8.2 and 11.5, the constitution v2.1.0, 001 research D19 (customer data lives in an erasable party record), 002's import design (research D12) and 003's plan (it calls this feature through `PartyLedgerPort`).

**Build order** (002 research D16): after 005 (roles, approvals) and before 003. So this feature must let a credit bill reach the ledger with the 001 bill screen, before 003's split tenders exist (D3).

**Scope**: US1 to US4 (P1, MVP). US5 and US6 (promises, cheque register, bank matching, sites, commission, write-off) are V2 and **not planned** (constitution VII).

## Decisions

### D1. Party record holds the contact data; bills hold only the id and a name snapshot

- **Decision**: `party` holds type (`customer`, `contractor`, `dealer`, `distributor`, `staff`), name, address, area, pin code, GSTIN, price tier, credit limit, credit days, referrer, notes and `is_active`. Phones are rows in `party_phone` (one marked primary) so "two parties with the same phone" can be found and warned about, and a party can have several numbers.
- **Erasure later**: 001 research D19 put contact details in "a separate, erasable party record referenced by id". This feature keeps that shape: the ledger and bills reference `party_id` only (plus 001's `customer_name` snapshot on the bill). The erasure procedure itself (DPDP data requests) is feature 008.
- **Parties are deactivated, never deleted** (spec edge case).

### D2. Ledger: one append-only table, signed amounts, a rebuildable balance

- **Decision**: `party_ledger_entry(party_id, entry_type, amount_paise, doc_type, doc_id, business_date, note, approval_id, user_id)`; a positive amount means the party owes the shop (architecture 7.4). Entry types: `opening_balance`, `bill_credit`, `bill_cancel_reverse`, `bill_edit_reverse` (003), `credit_note` (003), `payment`, `payment_reverse`, `adjustment`. Append-only by trigger; corrections are opposite entries (FR-015).
- `party_balance` is a projection updated in the same transaction as each entry; `rebuildPartyBalances` recomputes it from entries, and a check at start-up and every night compares the two (SC-004). A difference is logged as an exception (005 `exception_event`) and never "fixed" silently.
- **Example**: opening ₹12,000, bill ₹8,000 on credit, payment ₹15,000: entries +12,000, +8,000, -15,000; balance ₹5,000.

### D3. Credit bills before feature 003

- **Decision**: this feature adds `bill.party_id` and a tender mode `credit` to `bill_tender`. On the 001 bill screen, choosing a party and "Credit (khata)" saves the bill with one `credit` tender for the whole total and writes one `bill_credit` ledger entry in the bill's transaction. Cancelling such a bill writes `bill_cancel_reverse`. 001's `unpaid` mode stays for old bills only.
- **Effect on 003**: 003's data model lists `bill.party_id` and the `credit` mode as its own additions; whichever feature merges first adds them, and with this build order it is this one. 003 then adds split tenders (part credit) on top. Recorded so 003's tasks skip these columns.
- **Rationale**: the spec's independent test needs credit bills; waiting for 003 would leave the ledger without its main entry type.

### D4. Allocation links credits to bills; ageing is derived

- **Decision**: `ledger_allocation(settling_entry_id, settled_entry_id, amount_paise)`, append-only, with absolute bounds so the same table serves distributor payables in 009 (whose purchase bills are negative entries). A payment or credit note (the settling entry) is allocated to open bill entries (the settled entries) oldest first, or to the bills the user selected (FR-003). A remainder stays unallocated as an advance (spec edge case "payment larger than all open bills"); later bills are allocated against the advance automatically. A `payment_reverse` writes negative allocation rows for that payment's allocations, never edits them.
- Open amount of a bill entry = its amount minus its allocations. Ageing = open amounts grouped by days since the bill's `business_date` into 0-30, 31-60, 61-90 and 90+ (`ageOpenItems` in core; cut points a setting, architecture 11.5).
- **Example**: bills ₹3,000 (1 Jan), ₹5,000 (20 Jan), ₹2,000 (10 Feb); payment ₹6,000 on 15 Feb with none selected: ₹3,000 to the first, ₹3,000 to the second; open ₹2,000 + ₹2,000 = ₹4,000.

### D5. Credit checks at billing

`checkPartyCredit({ limitPaise, balancePaise, newCreditPaise, overdueBills, warnAtBp: 8000 })` in core returns `ok`, `warn_near_limit` (at or above 80% after the sale), `over_limit` or `overdue` (any open bill older than the party's credit days, with the reason "Overdue bill #C1/26-27/000098"). `over_limit` and `overdue` need an approval through feature 005 (kind `over_credit`), whose id is stored on the bill's credit tender. A party with a limit of 0 or null has no credit until the owner sets one ("Credit not allowed").

**Accepted risk (staff review 2026-11-18): limits are only as fresh as the last sync.** With two counters, each checks the limit against its own copy of the ledger. Example: limit ₹50,000, balance ₹40,000; offline, counter 1 and counter 2 each sell ₹8,000 on credit, each sees ₹48,000 (96%, allowed) and together the party reaches ₹56,000. When sync (010) brings both bills together, an `over_credit_after_sync` exception is raised for the owner; the bills stand (they were printed). 010's simulation includes this case.

### D6. Payments and receipts

- `payment(direction = 'in', party_id, mode, amount_paise, reference, cheque_no, cheque_bank, cheque_date, receipt_no, business_date, user_id)`; modes `cash`, `upi`, `cheque`, `bank_transfer`. UPI needs a reference (FR-005); the same UPI reference twice in a business is refused (EC-06 duplicate UPI; a partial unique index, shared with 003's bill tenders through one lookup).
- One transaction: payment, `payment` ledger entry, allocations, receipt number. Idempotent by `client_payment_id`.
- Receipt numbers come from 001's `number_series` with `doc_kind` `receipt` (`RC{counter}/{fy}/{seq5}`, at most 16 characters). `doc_kind` was introduced by 003's plan; whichever merges first adds the column.
- A cheque is recorded as a payment when received (its number, bank and date kept). Bounce handling is V2 (FR-010); until then a bounced cheque is corrected with `payment_reverse` and a reason.

### D7. WhatsApp statements and reminders: links, not an API

- **Decision**: a statement (period, opening balance, entries, closing balance) is rendered as a PDF with the existing `printToPDF` path and saved locally. "Send statement" opens `https://wa.me/<phone>?text=<message>` in the system browser; the message gives the closing balance, the shop's UPI ID and a `upi://pay?...` link built with 003's `buildUpiIntent` (or this feature's copy, whichever merges first). The PDF is attached by the user in WhatsApp.
- **Conflict with the spec's assumption**: the spec assumes "wa.me plus a hosted PDF". Hosting needs a server, which arrives with feature 010. Until then the PDF stays local. Recorded as OI-2.
- **Bulk reminders** (FR-007): the owner picks a template (English or Hindi, with placeholders `{name}`, `{amount}`, `{oldest_bill}`, `{upi_id}`) and the app steps through the overdue list, opening one chat at a time with a "Next" button. Each opening is logged in `reminder_log` with the template, channel `whatsapp_link` and time. The log records that the message was **prepared**, not that it was delivered, because a link cannot report delivery.
- **Risk**: SC-003 (50 parties in under 2 minutes of owner time) needs about 2 seconds per party with the link method. Measured in the trial; the WhatsApp Business Platform (feature 013, pilot) is the fallback.
- **Consent**: statements and reminders about money owed are transactional and send regardless of marketing consent (EC-17); promotions are not built here.

### D8. Consent records start here

- **Decision**: `consent_record(party_id, purpose, granted, recorded_at, source, notice_version)`, append-only; purposes `transactional` and `marketing`. The quick-add consent tick on the bill screen (003 FR-007) writes one. The current state is the latest row per purpose.
- **Split with 008**: the notice text, the DPDP data-request flow and erasure are feature 008; the spec's assumption "consent state comes from 008" is met by 008 reading and extending this table.

### D9. Opening balances import reuses 002's import engine

- **Decision**: parties and opening balances import through 002's `ImportService` preview (if OD-1 of 002 is accepted; otherwise this feature builds the small CSV preview it needs and 012 reuses it). Columns: name, type, phones, address, area, pin, GSTIN, tier, credit limit, credit days, opening balance, as-of date. Preview shows errors, duplicate groups (same phone or near-identical name, using 002's `findLikelyDuplicates` on names) and the total of opening balances; confirming requires typing the total shown in the source (SC-005: "matches within zero rupees").
- Each party gets one `opening_balance` entry dated the as-of date. Re-running the same file finds every party as an existing one and posts nothing new (an `import_batch_id` on each opening entry; the same party cannot get two opening entries).

### D10. GSTIN validation

Format: 15 characters, 2-digit state code, 10-character PAN, entity number, `Z`, check character. The check character uses the base-36 checksum widely documented for GSTIN. Checked in core as a **warning** (not a block) until OI-1 is verified against real GSTINs; the state code is also used by 003's inter-state check.

### D11. Party-specific prices

`party_price(party_id, variant_id, price_paise)` (architecture 7.4) is stored and edited here; 003 reads it first when pricing (003 research D2). A small editor on the party page lists them.

## Open items

| ID   | Item                                                                                                             | Resolve by                | Milestone |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ------------------------- | --------- |
| OI-1 | GSTIN check-character algorithm verified on 20 real GSTINs from the shop's distributors                          | Owner's distributor bills | M2        |
| OI-2 | Hosted statement PDF needs a server (010); local PDF attached by hand until then                                 | Owner accepts             | M4        |
| OI-3 | `upi://` links open from a WhatsApp message on the customers' phones (Android and iPhone)                        | Test with 5 phones        | M4        |
| OI-4 | Hindi reminder template wording                                                                                  | Owner                     | M4        |
| OI-5 | Ageing measured from bill date, not from due date (bill date + credit days); PRD says "days since the bill date" | Owner confirms            | M3        |

## References

- WhatsApp click-to-chat: https://faq.whatsapp.com/5913398998672934 (primary vendor documentation).
- WhatsApp Business Platform (later fallback): https://developers.facebook.com/docs/whatsapp/cloud-api (primary vendor documentation).
- NPCI UPI Linking Specifications: https://www.npci.org.in/ (primary).
- GSTIN structure: CBIC GST portal FAQ on GSTIN format, https://tutorial.gst.gov.in/ (primary for the format; the check-character algorithm is published by third parties only, hence OI-1).
- Digital Personal Data Protection Act 2023 and the DPDP Rules 2025 (consent and purpose limitation): https://www.meity.gov.in/data-protection-framework (primary).
- Industry practice: Khatabook and OkCredit (Indian credit-ledger apps) send balance reminders as WhatsApp or SMS messages with a payment link (product pages, vendor marketing, secondhand); QuickBooks applies customer payments to the oldest open invoices by default and lets users pick invoices (https://quickbooks.intuit.com/learn-support/en-us/help-article/customer-payments/record-invoice-payments-quickbooks-online/L2F7Wvp6S_US_en_US, primary vendor documentation). Double-entry accounting systems keep entries immutable and correct by reversing entries (standard practice; Martin Fowler, "Accounting Patterns", https://martinfowler.com/eaaDev/AccountingNarrative.html, primary author's writing).
