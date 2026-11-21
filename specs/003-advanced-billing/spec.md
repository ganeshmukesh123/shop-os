# Feature Specification: Advanced Counter Billing

**Feature Branch**: `003-advanced-billing`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Extend the basic bill with price tiers, discounts with limits, MRP and below-cost guards, split payments and UPI confirmation, held bills, returns, quotations, edit and cancel rules, unmet demand, and inter-state checks."

**PRD source**: `docs/reference/PRD.md` section 6 (FR-BIL-001 to 025), US-01 to 04, US-06, US-07, EC-01, EC-04, EC-05, EC-09, EC-11, EC-12, EC-18, EC-19.

**Depends on**: 001 (basic bill), 002 (variants and grid), 004 (parties and credit), 005 (approvals and discount limits). (Note: downstream feature 008 extends bill formatting for formal GST scheme switching and tax invoices).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fast keyboard billing with price tiers (Priority: P1)

Staff add lines by typing 2+ characters or scanning, Enter adds the top match, a variant family opens a grid, price fills from the customer's tier (Retail, Contractor, Dealer) or a customer-specific price, and shortcuts cover new bill, hold, recall, quotation, return, customer, pay and print.

**Why this priority**: Billing speed in rush hours is the first success measure (45 seconds for 5 lines).

**Independent Test**: Bill 5 lines by keyboard only; switch the customer to Contractor and see all lines reprice; use a customer-specific price on one item.

**Acceptance Scenarios**:

1. **Given** a new bill, **Then** the search box is focused and ready to type.
2. **Given** "pip 1" typed, **When** Enter is pressed on the top match, **Then** it is added with quantity 1.
3. **Given** a bill with retail prices, **When** a Contractor-tier party is selected, **Then** every line reprices and totals update; **Given** a customer-specific price exists, **Then** it wins over the tier.
4. **Given** a grid is open, **Then** arrow keys and Enter navigate and add.
5. **Given** a quantity that breaks the item's unit or decimal rule, or a decimal on a sealed pack, **Then** it is rejected.
6. **Given** up to 10 held bills on a counter, **Then** they can be recalled; an 11th is refused with an explanation.

---

### User Story 2 - Price guards: MRP cap and below-cost approval (Priority: P1)

A line priced above the batch MRP is blocked. A line below landed cost needs the owner's approval, by PIN at the counter or remotely, and the approval is logged. Staff can switch batch; the cap uses the selected batch.

**Why this priority**: Legal Metrology compliance and margin protection are core shop rules.

**Independent Test**: Batch MRP 450: entering 460 is blocked; landed cost 300: entering 290 requests approval; approve, reject and time out each behave correctly.

**Acceptance Scenarios**:

1. **Given** MRP 450, **When** 460 is entered, **Then** the line is blocked with "Above MRP 450".
2. **Given** landed cost 300, **When** 290 is entered, **Then** an approval is requested; on approval the line saves and is logged; on rejection or 2-minute timeout the line reverts.
3. **Given** no purchase cost yet, **Then** the below-cost check is skipped and a "cost unknown" badge shows.
4. **Given** a batch with two MRPs, **Then** the oldest is picked and staff can switch.

---

### User Story 3 - Discounts, split payment and UPI confirmation (Priority: P1)

Line and bill discounts (percent or rupees) respect the user's limit. Payment accepts cash, UPI, card, credit and combinations with change for cash. UPI shows a QR with the exact amount and stays Pending until the bank or soundbox reference is entered. A credit sale over the customer's limit needs approval.

**Why this priority**: Fake payment screenshots and over-credit are the owner's biggest fears.

**Independent Test**: Split a 2,000 bill into 1,000 cash and 1,000 UPI; save UPI without reference (pending); enter the reference (confirmed); try a credit sale over the limit.

**Acceptance Scenarios**:

1. **Given** a discount above the user's limit, **Then** it needs approval.
2. **Given** cash 2,000 on a 1,850 bill, **Then** change due shows 150.
3. **Given** UPI selected, **Then** the QR shows the exact amount; **Given** save without reference, **Then** the bill saves with UPI Pending and appears on the owner's Today card and at day close.
4. **Given** the reference is entered, **Then** status becomes Confirmed.
5. **Given** a credit sale beyond the party's limit (limit 50,000, balance 45,000, bill 8,000), **Then** owner approval is required.
6. **Given** a customer shows UPI success but the bank shows nothing, **Then** the bill stays pending and staff may take another payment mode.

---

### User Story 4 - Returns and credit notes (Priority: P2)

Staff find the original bill by number, phone or by scanning the printed QR, choose lines and quantities, pick sellable or defective location, and refund by cash, UPI or credit note. A return without a bill needs owner approval.

**Why this priority**: Returns are frequent and must keep stock and balances honest.

**Independent Test**: Return 2 of 5 lines by credit note; ledger reduces, stock returns; return a retail-customer item bought at contractor price and see the original price refunded.

**Acceptance Scenarios**:

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:535626b85de6905f84d0ab74e67422d0afc62d7826e99e89b6f1958c4a617d73 -->

1. **Given** a printed bill with QR, **When** scanned in Return mode, **Then** its lines appear for selection.
2. **Given** refund by credit note, **Then** the party ledger reduces and stock goes to the chosen location.
3. **Given** no original bill, **Then** the return needs owner approval.
4. **Given** an item sold at contractor price returned by a retail customer, **Then** the refund is at the original price (EC-11).
5. **Given** a partial return of a kit, **Then** the refund is prorated by component value (EC-12).
6. **Given** a tinted line marked non-returnable, **Then** no return posts without owner approval; with approval, the return credits a reduced value and routes the tinted pack to the shop's `tinted_returns` location (FR-TNT-007).

<!-- /coderabbit-ai-generated:v1 -->

---

### User Story 5 - Quotations (Priority: P2)

Staff build a quotation on the bill screen with a validity date (default 7 days), share it on WhatsApp, and convert it fully or partly into a bill, keeping or refreshing prices. Revisions keep version numbers.

**Why this priority**: Contractors request quotes daily.

**Independent Test**: Make a 7-day quote, convert on day 5 (prices stay) and day 9 (choice offered), and convert part of it.

**Acceptance Scenarios**:

1. **Given** a quote valid 7 days, **When** converted on day 5, **Then** prices stay; on day 9 staff choose keep or refresh.
2. **Given** a partial conversion, **Then** remaining quantities stay open on the quote.
3. **Given** a revised quote, **Then** a new version number is kept and earlier versions are viewable.

---

### User Story 6 - Edit, cancel and unmet demand (Priority: P2)

Saved bills are editable only the same day by permitted roles, creating a new version with the previous one in the audit log. Cancel needs a reason and owner approval and keeps the number. Staff can record "asked for, not available" in one tap from the search box.

**Why this priority**: Completes the control loop begun in 001.

**Independent Test**: Edit a bill the same day (new version); try the next day (refused); cancel with approval; record an unmet demand.

**Acceptance Scenarios**:

1. **Given** bill C1/26-27/000123 (2 pcs x ₹120 = ₹240) from the same business day, **When** an allowed role changes it to 3 pcs, **Then** version 2 (₹360) saves under the same number, version 1 stays readable unchanged, stock gets a reversing +2 and a new -3 movement, and the audit log records who, when and why.
2. **Given** a bill from a previous day, **Then** edit is refused and a return or credit note is offered (EC-18).
3. **Given** a cancel, **Then** reason and owner approval are required; the cancelled bill keeps its number and appears in the exceptions report.
4. **Given** a search with no match, **Then** one tap records unmet demand with free text or item.
5. **Given** a crash left a gap in bill numbers, **Then** the gap is listed with reason "device crash" (EC-19).

---

### User Story 7 - Later increments (Priority: P3)

Inter-state check and format by registration come from 008. Site return of unused contractor-site material (V2, FR-BIL-024), challan and partial delivery (V2, with 006), and quote from a pasted list or photo (V3, FR-BIL-025) follow.

**Independent Test**: Process a contractor site return linking unused material to original delivery bill lines; verify stock returns to the site rack, credit posts to the contractor ledger, and values exceeding threshold trigger approval.

**Acceptance Scenarios**:

1. **Given** unused material returned from a contractor site, **Then** it is accepted against original bills at original or revised price, with approval above a set value.

---

### Edge Cases

- Internet drops mid-bill: the bill continues and saves (EC-01).
- Printer out of paper: the bill saves, with retry, WhatsApp or reprint later (EC-04).
- Customer withdraws consent mid-bill: transactional bill still prints.
- Return after tier price changed: refund uses original bill price.
- Two lines of the same item: allowed, each line tracked.

## Requirements *(mandatory)*

### Functional Requirements

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:9a26ece1dee94abca4ec307fcc1ead320ac8d2f5087c31887eb0853eee2c3c96 -->

- **FR-001**: Counter MUST open on a new bill with the search box ready; add lines by 2+ characters or scan; Enter adds top match at quantity 1; a family opens the variant grid (FR-BIL-001, FR-BIL-002).
- **FR-002**: System MUST provide shortcuts for new, hold, recall, quote, return, customer, pay, print, and keyboard navigation of the grid (FR-BIL-003).
- **FR-003**: Price MUST fill from the customer tier or customer-specific price; changing the tier reprices all lines (FR-BIL-004).
- **FR-004**: System MUST support line and bill discounts as percent or rupees, limited by the user's limit (FR-BIL-005).
- **FR-005**: System MUST block lines above batch MRP and require owner approval for lines below landed cost (FR-BIL-006, FR-BIL-007).
- **FR-006**: Quantity MUST respect unit and decimal settings; sealed packs accept whole numbers (FR-BIL-008).
- **FR-007**: Customer MUST be optional for cash sales and required for credit, contractor tier and warranty items, with quick-add of name, phone and consent tick (FR-BIL-009).
- **FR-008**: Payment MUST accept cash, UPI, card, credit and combinations with change due for cash (FR-BIL-010).
- **FR-009**: UPI MUST show a QR with the exact amount and stay Pending confirmation until a reference is entered or a connected provider confirms; pending UPI MUST appear at day close and on the Today card (FR-BIL-011).
- **FR-010**: Credit sales beyond limit MUST need owner approval (FR-BIL-012).
- **FR-011**: Bill numbers MUST stay unique per counter and financial year (FR-BIL-013).
- **FR-012**: Bill format MUST follow the shop's registration at the bill date; output MUST include thermal, A4/A5 and WhatsApp share, and printer failure MUST NOT block save (FR-BIL-014, FR-BIL-015).
- **FR-013**: System MUST hold up to 10 bills per counter (FR-BIL-016).
- **FR-014**: Same-day edit (same business date in the shop's time zone, roles with permission from 005) MUST save a new bill version that keeps the bill number; the previous version MUST stay stored, unchanged and readable, and the edit MUST be written to the audit log with user, time and reason. No version is ever overwritten. Stock and ledger changes from an edit are new opposite and new entries, never edits. Cancel MUST need reason and owner approval and keep the number (FR-BIL-017, FR-BIL-018; constitution v2.0.0 principle I, owner decision 2026-11-15).
- **FR-015**: Returns MUST work against an original bill by number, phone or QR, with refund by cash, UPI or credit note and sellable or defective routing; no-bill returns need approval (FR-BIL-019). The tinted-paint exception requires owner approval via 005, a reduced refund value and routing to `tinted_returns` (FR-TNT-007, deferred from 002).
- **FR-016**: Quotations MUST support validity (default 7 days), WhatsApp share, full or partial conversion with locked or refreshed prices, and version numbers (FR-BIL-020).
- **FR-017**: System SHOULD capture unmet demand in one tap (FR-BIL-021).
- **FR-018**: System MUST block inter-state sales under composition with an explanation (FR-BIL-022, shared with 008).
- **FR-019 [V2/V3]**: Challan and partial delivery (FR-BIL-023, with 006); site return (FR-BIL-024); quote from list (FR-BIL-025).

<!-- /coderabbit-ai-generated:v1 -->

### Key Entities

- **Bill / Bill Line / Bill Version**: Existing from 001, extended with tier, versions, batch and UPI status.
- **Payment Split**: One bill's list of payment parts with mode, amount, reference, confirmation status.
- **Quotation / Quotation Version / Conversion**: Quote with validity and its link to resulting bills.
- **Return / Credit Note**: Return lines against a bill, refund mode, destination location.
- **Held Bill**: Parked draft by counter.
- **Unmet Demand**: Text or item the customer asked for.
- **Price Tier / Customer Price**: Tier prices per item and party-specific overrides.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A 5-line bill is saved in 45 seconds or less by a trained user, and no slower than the old method.
- **SC-002**: Item search results are chosen in the top 3 for 90% of searches.
- **SC-003**: 98% of UPI payments are confirmed the same day.
- **SC-004**: Zero bills above MRP are saved in a 2-week trial.
- **SC-005**: 100% of below-cost, over-discount and over-credit lines show an approval record.
- **SC-006**: A return is processed in under 60 seconds with a bill, with stock and ledger both correct.

## Assumptions

- Approvals and roles are built in 005; until then the owner PIN on the device is used.
- Credit limits and ledgers come from 004; before then credit sales are unavailable.
- Print layouts are as set in 001 and extended for tier and discount lines.
- Online UPI confirmation by a payment provider is later; staff-entered reference is the MVP.
