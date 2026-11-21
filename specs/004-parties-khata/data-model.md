# Data Model: Parties and Khata (Credit)

Builds on 001's target shape and 002's `price_tier`. Uses 005's `app_user`, `approval_request` and `exception_event` by id. Conventions unchanged. Decisions in `research.md` D1 to D11.

## Overview

```
price_tier 1--* party *--0..1 party (referred_by)
                  |  1--* party_phone
                  |  1--* party_price *--1 item_variant
                  |  1--* consent_record
                  |  1--1 party_balance (projection)
                  |  1--* party_ledger_entry 1--* ledger_allocation (as credit or debit)
                  |  1--* payment ---------> party_ledger_entry (entry_type payment)
                  |  1--* reminder_log
bill *--0..1 party        bill_tender.mode adds 'credit'
```

## New tables

### `party`

| Field                | Rule                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| party_type           | `customer`, `contractor`, `dealer`, `distributor`, `staff`             |
| name                 | text 1-80, trimmed                                                     |
| address              | text up to 200, nullable                                               |
| area                 | text up to 60, nullable                                                |
| pin_code             | 6 digits, nullable                                                     |
| gstin                | 15 characters, upper case, nullable; format checked as a warning (D10) |
| price_tier_id        | FK to `price_tier`, not null, default Retail                           |
| credit_limit_paise   | integer 0 or more, nullable (null or 0 = no credit)                    |
| credit_days          | integer 0 to 365, nullable                                             |
| referred_by_party_id | nullable FK to `party`, not itself                                     |
| notes                | text up to 500, nullable                                               |
| is_active            | 0 or 1, default 1; never deleted                                       |

### `party_phone`

`party_id`, `phone` (10 digits for Indian mobiles, stored as digits only; `+91` stripped), `is_primary` (one per party, partial unique index), `UNIQUE(party_id, phone)`, index on `phone` (not unique: same phone on two parties is warned, allowed).

### `party_price`

`party_id`, `variant_id`, `price_paise` 0 or more, `UNIQUE(party_id, variant_id)`. Master data (may be edited; changes logged by 005's audit).

### `consent_record` (append-only)

`party_id`, `purpose` (`transactional`, `marketing`), `granted` (0 or 1), `recorded_at`, `source` (`counter`, `import`, `party_page`), `notice_version` (text, nullable until 008 adds notices), `user_id`. Current consent = latest row per purpose.

### `party_ledger_entry` (append-only)

| Field                           | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| party_id                        | FK, not null                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| entry_type                      | `opening_balance`, `bill_credit`, `bill_cancel_reverse`, `bill_edit_reverse`, `credit_note`, `payment`, `payment_reverse`, `adjustment`                                                                                                                                                                                                                                                                                                                                                             |
| amount_paise                    | signed integer, not 0; positive = party owes the shop. The sign rule is data: `entry_type` is a foreign key to a `ledger_entry_type` lookup table (`code`, `sign`: `positive`, `negative` or `either`), checked by a trigger (002 research D17), so 009 adds `purchase_bill`, `debit_note`, `payment_out` by INSERT. Seeded: `opening_balance` and `adjustment` either; `bill_credit` and `payment_reverse` positive; `bill_cancel_reverse`, `bill_edit_reverse`, `credit_note`, `payment` negative |
| doc_type, doc_id                | `bill`, `payment`, `sales_return`, `import_batch` or null for `adjustment`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| business_date                   | text `YYYY-MM-DD`, not null                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| note                            | text up to 200; required for `adjustment` and `payment_reverse`                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| approval_id                     | nullable FK; required for `adjustment`                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| import_batch_id                 | nullable; `UNIQUE(party_id) where entry_type = 'opening_balance'` (one opening entry per party)                                                                                                                                                                                                                                                                                                                                                                                                     |
| user_id, device_id, occurred_at | as on movements                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Triggers reject UPDATE and DELETE.

### `ledger_allocation` (append-only)

- `settling_entry_id` identifies the credit applied: a `payment`, `credit_note` or negative customer `opening_balance` in 004; a `payment_out` or `debit_note` in 009.
- `settled_entry_id` identifies the debt reduced: a `bill_credit` or positive `opening_balance` in 004; a `purchase_bill` in 009. Both entries must belong to the same party. Reject the entire payment before writing anything if any requested `allocateTo` bill belongs to a party other than `partyId`, including for distributor payables.
- `amount_paise` is the signed change in allocated magnitude: positive applies credit, negative releases it. For each settling entry and each settled entry, its net allocated magnitude must stay between zero and the absolute value of its entry amount. For example, a −₹1,000 customer opening balance settling a later ₹600 bill uses the opening entry as settling, the bill as settled and +60,000 paise as the allocation; the bill has zero open amount and ₹400 remains available.
- **Credit bill cancellation:** In the same transaction as `bill_cancel_reverse`, append a negative allocation for the outstanding net allocation of each settling/settled pair on that bill, using the same IDs. This zeros those pairs and returns the released amounts to the original sources as unallocated credit. In the same transaction, the released credit is applied to the party's other open bills, oldest `business_date` first (the D4 rule for payments), and only what is left stays as an advance. Example: credit bill A ₹100 had ₹40 paid; bill B ₹50 is open and overdue; cancelling A releases ₹40 onto B, so B shows ₹10 open in ageing and reminders, and no advance remains. A cancelled bill has zero open amount and cannot receive new allocations. Exclude it from ageing and reminders. Later reversals unwind only still-active allocations, so they cannot release the same allocation twice.

### `party_balance` (projection)

`party_id` unique, `balance_paise`, `updated_at`. Updated in the same transaction as each ledger entry; rebuildable from entries.

### `payment` (append-only)

| Field                                          | Rule                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| client_payment_id                              | unique per shop (idempotency)                                                                        |
| direction                                      | `in` in this feature (`out` for distributors comes with 009)                                         |
| party_id                                       | FK, not null                                                                                         |
| mode                                           | `cash`, `upi`, `cheque`, `bank_transfer`                                                             |
| amount_paise                                   | integer above 0                                                                                      |
| reference                                      | required for `upi` and `bank_transfer`; unique per business for `upi`                                |
| cheque_no, cheque_bank, cheque_date            | required for `cheque`                                                                                |
| receipt_no, number_series_id, seq              | from `number_series` with `doc_kind` `receipt`; at most 16 characters; `UNIQUE(shop_id, receipt_no)` |
| business_date, received_at, user_id, device_id |                                                                                                      |

### `reminder_log` (append-only)

`party_id`, `kind` (`statement`, `reminder`, `receipt`), `template_code`, `language` (`en`, `hi`), `channel` (`whatsapp_link`, `print`), `phone`, `amount_paise` (balance at the time), `prepared_at`, `user_id`.

### `message_template`

`code`, `kind`, `language`, `body` (up to 1,000 characters; placeholders `{name}`, `{amount}`, `{oldest_bill}`, `{upi_id}`, `{shop_name}`), `is_active`. Seeded with one English and one Hindi reminder and statement template.

## Changed tables

- `bill`: adds `party_id` (nullable FK to `party`), research D3.
- `bill_tender`: lookup row `tender_mode` `credit` (no rebuild: 002 D17 already replaced 001's `bill_tender_mode` CHECK with a foreign key to `tender_mode`, and 004 requires 002, confirmed by T001); a `credit` tender needs `bill.party_id` (service check and test); `approval_id` nullable.

- `number_series`: `doc_kind` adds `receipt`. If 003 has not added the lookup and column, seed `bill` as the default, backfill existing rows as `bill`, and extend `number_series_uq` to `(shop_id, counter_code, financial_year, doc_kind)`.

- `shop_profile`: adds `upi_vpa` and `upi_payee_name` if 003 has not yet; `ageing_buckets` JSON default `[30, 60, 90]`.

## Derived values (in `@shopos/core`)

- `sumLedger(entries)`; `allocateOldestFirst(openDebits, creditPaise, selectedDebitIds?)` returning allocation rows and the unallocated remainder.
- `openAmounts(debits, allocations)`; `ageOpenItems(openItems, todayBusinessDate, bucketCutsDays)`.
- `checkPartyCredit(...)` (research D5).
- `buildStatement({ entries, fromDate, toDate })`: opening balance first, entries in date order, closing balance; opening equals the sum of entries before `fromDate`.
- `renderMessageTemplate(template, values)`; `isValidGstinFormat(gstin)`, `gstinCheckCharacter(first14)`.

Example: limit ₹50,000, balance ₹45,000, new credit ₹8,000: after the sale ₹53,000, so `over_limit`; a ₹2,000 credit sale would give ₹47,000, 94% of the limit, so `warn_near_limit`.

## State

- Party: active, inactive.

- Bill credit entry: cancelled (zero open amount by the credit bill cancellation rule above); otherwise open (open amount above 0) or settled (0), derived from allocations.

- Payment: posted; reversed (a `payment_reverse` exists); derived.

## Indexes

- `party(name COLLATE NOCASE)`, `party_phone(phone)`, `party(party_type, is_active)`.
- `party_ledger_entry(party_id, business_date)`, `party_ledger_entry(doc_type, doc_id)`.
- `ledger_allocation(settled_entry_id)`, `ledger_allocation(settling_entry_id)`.
- `payment(business_id, reference) where mode = 'upi'` unique; `payment(party_id, business_date)`.
- `reminder_log(party_id, prepared_at)`.
