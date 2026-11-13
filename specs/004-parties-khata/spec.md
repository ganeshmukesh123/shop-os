# Feature Specification: Parties and Khata (Credit)

**Feature Branch**: `004-parties-khata` (no git repository yet; directory name only)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Party records (customer, contractor, dealer, distributor, staff), a running ledger per party, credit limits and days, ageing, payments, WhatsApp statements and bulk reminders, opening balances, and later promised dates, cheques, bank matching, contractor sites, commission and write-off."

**PRD source**: `docs/reference/PRD.md` section 8 (FR-KHA-001 to 014), US-05, US-08, US-15, US-16, EC-06, EC-14, EC-17, BO-2.

**Depends on**: 001 (bills), 003 (credit sales), 005 (approvals), 008 (consent rules). Distributors in the party list are used by 009.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Party ledger with credit limit and days (Priority: P1)

Each party has contact details, a price tier, a credit limit and credit days, and a running ledger of bills, returns, payments, credit notes, opening balance and adjustments. The balance always equals the sum of its entries.

**Why this priority**: Credit stuck with contractors is the biggest cash drain, and every other khata function builds on the ledger.

**Independent Test**: Create a contractor with a 50,000 limit, post bills and a payment, and verify the balance equals the entries and a credit sale beyond the limit needs approval.

**Acceptance Scenarios**:

1. **Given** a new party, **Then** name, phone(s), address, area/pin code, optional GSTIN, price tier, credit limit, credit days, referrer, consent status and notes can be stored; the type is Customer, Contractor, Dealer, Distributor or Staff (for advances).
2. **Given** ledger entries, **Then** balance = sum of entries.
3. **Given** a party reaches 80% of the limit, **Then** billing warns.
4. **Given** limit 50,000 and balance 45,000, **When** an 8,000 credit bill is attempted, **Then** it needs owner approval.
5. **Given** a bill 15 days past credit days, **Then** any new credit sale needs approval with reason "Overdue bill #...".

---

### User Story 2 - Ageing and receiving payments (Priority: P1)

The owner sees overdue amounts in buckets 0-30, 31-60, 61-90 and 90+ days, bill by bill. Payments (cash, UPI with reference, cheque, bank transfer) apply to the oldest bills unless one is selected, and a receipt is printed or sent on WhatsApp.

**Why this priority**: Faster collection is business objective BO-2 (overdue down 30% in 90 days).

**Independent Test**: Post bills of different ages, receive a payment, and confirm it clears the oldest first and ageing updates.

**Acceptance Scenarios**:

1. **Given** unpaid bills of varying age, **Then** ageing shows per bill and per bucket.
2. **Given** a payment with no bill selected, **Then** it applies oldest first; **Given** a bill is selected, **Then** it applies there.
3. **Given** payment recorded, **Then** a receipt prints or sends on WhatsApp.
4. **Given** a UPI payment, **Then** its reference is stored.

---

### User Story 3 - WhatsApp statements and reminders (Priority: P1)

One tap sends a statement (period, opening balance, bills, payments, closing balance) with a UPI payment link to a party. The owner sends reminders to all overdue parties in one action using a Hindi or English template, and each send is logged.

**Why this priority**: Collection by WhatsApp is the main way the owner will reduce overdue credit.

**Independent Test**: With 12 overdue parties, send reminders and confirm 12 statements with links and 12 log entries; withdraw one party's marketing consent and resend.

**Acceptance Scenarios**:

1. **Given** a party, **When** the owner taps Send statement, **Then** the statement and a UPI link go to their number.
2. **Given** 12 overdue parties, **When** Send reminders is tapped, **Then** each receives a statement and link and each send is logged per party.
3. **Given** a party withdrew marketing consent, **Then** transactional statements still send but promotions do not (US-08, EC-17).

---

### User Story 4 - Opening balances import (Priority: P1)

The owner imports opening balances from Excel or old books party by party and confirms a total.

**Why this priority**: The shop cannot go live without existing balances.

**Independent Test**: Import 100 parties with balances; the confirmation total matches the source.

**Acceptance Scenarios**:

1. **Given** a spreadsheet of parties and balances, **Then** a preview lists errors and duplicates and a total for confirmation.
2. **Given** confirmation, **Then** each party gets an opening-balance ledger entry.

---

### User Story 5 - Promised dates, cheques, bank matching (Priority: P2, V2)

The owner records "will pay X on date" and sees follow-ups that day; broken promises are counted. A cheque register tracks Received, Deposited, Cleared or Bounced and post-dated cheques appear on their date; a bounce re-opens the bills and records charges. A bank statement import auto-matches UPI and bank receipts by reference, amount and date.

**Why this priority**: Improves collection and accuracy but is not needed for the first khata release.

**Independent Test**: Mark a cheque bounced and see bills re-open and charges post; import a bank file and see automatic and manual matches.

**Acceptance Scenarios**:

1. **Given** a promised date, **Then** the party appears on that day's follow-up list.
2. **Given** a cheque marked Bounced after more credit was given, **Then** bills re-open, charges post and the party is "blocked for credit" until cleared (EC-14, US-15).
3. **Given** a bank statement file, **Then** matches are made by reference, amount and date and unmatched items are listed.
4. **Given** the same UPI payment received twice, **Then** the duplicate is flagged (EC-06).

---

### User Story 6 - Contractor sites, commission and write-off (Priority: P3, V2)

A contractor can have several sites; bills tag a site; statements and balances are per site and total (US-16). Referral commission accrues when a referred bill is fully paid and is settled by payout entries. Bad debt is written off with owner approval and reason.

**Independent Test**: Tag two bills to two sites and send site-wise statements; pay a referred bill and see commission accrue.

**Acceptance Scenarios**:

1. **Given** two sites for one contractor, **Then** one statement per site and a total are produced.
2. **Given** a referral rule of a percent of bill value (excluding returns), **When** the referred bill is fully paid, **Then** commission accrues.
3. **Given** a write-off, **Then** owner approval and a reason are required.

---

### Edge Cases

- Two parties with the same phone: warned, allowed.
- Payment larger than all open bills: remainder stays as advance credit.
- Party deleted: parties are deactivated, never deleted.
- Statement period spanning an opening balance: opening balance shows first.
- Customer withdraws consent: marketing stops; bills and ledgers stay (EC-17).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store parties of type Customer, Contractor, Dealer, Distributor or Staff with name, phone(s), address, area/pin, optional GSTIN, tier, credit limit, credit days, referrer, consent status and notes (FR-KHA-001).
- **FR-002**: System MUST keep a per-party ledger whose balance equals the sum of its entries (FR-KHA-002).
- **FR-003**: System MUST show bill-by-bill ageing in buckets 0-30, 31-60, 61-90, 90+ with payments applied oldest first unless a bill is selected (FR-KHA-003).
- **FR-004**: System MUST warn at 80% of limit and block above the limit or past credit days unless the owner approves (FR-KHA-004).
- **FR-005**: System MUST receive payments by cash, UPI with reference, cheque and bank transfer, applied automatically or manually, with a printable or WhatsApp receipt (FR-KHA-005).
- **FR-006**: System MUST send a WhatsApp statement with a UPI payment link per party (FR-KHA-006).
- **FR-007**: System MUST send reminders to all overdue parties in one action using Hindi or English templates and log each send (FR-KHA-007).
- **FR-008**: System MUST import opening balances with a confirmation total (FR-KHA-008).
- **FR-009 [V2]**: Promised dates with follow-up lists and broken-promise counts (FR-KHA-009).
- **FR-010 [V2]**: Cheque register with statuses and post-dated display; a bounce re-opens bills and records charges (FR-KHA-010).
- **FR-011 [V2]**: UPI and bank statement matching with manual matching for unmatched items (FR-KHA-011).
- **FR-012 [V2]**: Contractor sites with per-site statements and balances (FR-KHA-012).
- **FR-013 [V2]**: Referral commission with accrual on full payment and payout entries (FR-KHA-013).
- **FR-014 [V2]**: Bad debt write-off with owner approval and reason (FR-KHA-014).
- **FR-015**: Ledger entries MUST be append-only; corrections are opposite entries (constitution principle II).

### Key Entities

- **Party**: Person or business with type, contact, tier, limits, consent, referrer.
- **Ledger Entry**: Bill, return, payment, credit note, opening balance or adjustment with amount and party.
- **Payment / Receipt**: Money received, mode, reference, allocation to bills.
- **Ageing Snapshot**: Derived per-bill age buckets.
- **Reminder Log**: Message sent, party, template, time, channel.
- **Promise, Cheque, Bank Statement Line, Site, Commission Rule, Write-off**: V2 entities.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Khata overdue more than 30 days falls by 30% within 90 days of go-live.
- **SC-002**: A statement reaches a party on WhatsApp in 2 taps from the party page.
- **SC-003**: Bulk reminders to 50 overdue parties complete in under 2 minutes of owner time.
- **SC-004**: Ledger balance equals the sum of entries for 100% of parties in a nightly check.
- **SC-005**: Opening balance import total matches the source within zero rupees.
- **SC-006**: Disputes about balances reduce measurably, tracked as problem reports tagged "balance" in the trial.

## Assumptions

- WhatsApp sharing uses links first (wa.me plus a hosted PDF); the business messaging API comes at the pilot.
- UPI payment link uses the shop's bank QR or UPI id; dynamic QR via a provider is later.
- Consent state comes from 008; statements are transactional and do not need marketing consent.
- Parties import (not only balances) uses the same file tooling as items in 001.
