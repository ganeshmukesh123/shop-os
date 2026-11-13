# Feature Specification: Reports, Expenses, Real Profit and CA Export

**Feature Branch**: `011-reports-expenses-export` (no git repository yet; directory name only)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Sales, exceptions and stock-value reports with Excel export, expenses and owner drawings, real profit with cost completeness, distributor scorecard, contractor ranking, price-change impact, targets, area map, and a CA export (quarterly turnover, annual data, purchases register, Tally-compatible)."

**PRD source**: `docs/reference/PRD.md` section 10 Reports (FR-RPT-001 to 010), FR-CMP-004, FR-CMP-014, personas (Mehta the CA), BO-3, NFR-015.

**Depends on**: 001 (bills, stock), 004 (parties), 005 (exceptions and approvals), 007 (stock by location, roll variance), 008 (turnover and tax), 009 (landed cost, claims, distributors).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Core reports with export (Priority: P1)

The owner views sales by day, item, category, brand, staff, customer and payment mode, exportable to Excel; an exceptions report of cancels, edits, over-limit discounts, below-cost sales, negative stock and returns without a bill; and stock value at cost by location and category.

**Why this priority**: Gives the owner one daily view and the evidence behind it.

**Independent Test**: Generate each report for a test day, export sales to Excel, and trace a total to its bills.

**Acceptance Scenarios**:

1. **Given** a date range, **Then** sales show by day, item, category, brand, staff, customer and payment mode and export to Excel.
2. **Given** risky events in the period, **Then** the exceptions report lists cancels, edits, discounts over limit, below-cost sales, negative stock and returns without a bill.
3. **Given** stock, **Then** value at cost shows by location and category.
4. **Given** any report number, **Then** it traces to its source documents in 3 taps or fewer.

---

### User Story 2 - Expenses and real profit (Priority: P1, V2)

The owner records expenses and owner drawings by category. Real profit = sales − returns − landed cost of goods sold − roll variance − rejected claims − write-offs − expenses, with a "cost completeness" percentage when items lack purchase cost.

**Why this priority**: Stopping margin leakage (BO-3) needs a trusted profit figure.

**Independent Test**: Enter expenses, then compute real profit for a month and see cost completeness below 100% when one item has no cost.

**Acceptance Scenarios**:

1. **Given** expense categories, **Then** expenses and drawings can be entered and reported.
2. **Given** a month of data, **Then** real profit is computed per the formula.
3. **Given** items without purchase cost, **Then** cost completeness shows under 100% (EC-08).

---

### User Story 3 - CA export (Priority: P1, V2)

One click produces quarterly turnover for CMP-08 (due the 18th after quarter end) and annual data for GSTR-4 (due 30 June), a purchases register, and a Tally-compatible file. Reminders appear 7 days before each due date. For a regular-scheme shop, GSTR-1 and GSTR-3B exports show sales by rate and B2B by GSTIN.

**Why this priority**: Gives the CA clean data each quarter; the PRD names one-click export as a persona need.

**Independent Test**: Export a quarter's data and open it in the CA's tool; compare totals with the turnover tracker.

**Acceptance Scenarios**:

1. **Given** a quarter, **Then** an export with turnover for CMP-08 is produced and totals match the turnover tracker.
2. **Given** a financial year, **Then** annual data for GSTR-4 and the purchases register are produced.
3. **Given** a due date 7 days away, **Then** a reminder shows.
4. **Given** a regular-scheme period, **Then** GSTR-1 and GSTR-3B exports group sales by rate and B2B by GSTIN.

---

### User Story 4 - Distributor scorecard and contractor ranking (Priority: P2, V2/V3)

A distributor scorecard shows price trend, delivery delay, short supply, roll variance and claim settlement time. A contractor ranking shows monthly purchase value, paid value, margin and overdue, by contractor and by electrician referrer (for Diwali gifts).

**Independent Test**: View the scorecard and ranking for a test month and compare with source figures.

**Acceptance Scenarios**:

1. **Given** purchase history, **Then** the scorecard shows the five measures per distributor.
2. **Given** sales and payments, **Then** the ranking shows purchase value, paid value, margin and overdue per contractor and referrer.

---

### User Story 5 - Price impact, targets and area map (Priority: P3, V3)

Price change impact compares units and margin 4 weeks before and after a price change per item. Monthly targets by shop, category and staff show progress. A customer area map by pin code shows only parties with consent.

**Independent Test**: Written when scheduled.

**Acceptance Scenarios**:

1. **Given** a price change, **Then** units and margin before and after show for 4 weeks each side.
2. **Given** a party without consent, **Then** it does not appear on the area map.

---

### Edge Cases

- A report across a scheme switch: both bill formats are included and labelled.
- Items with no cost in margin reports: shown with a cost-unknown flag, never hidden.
- Cancelled bills: excluded from sales, included in exceptions.
- Export larger than the spreadsheet row limit: split into parts with a note.
- Returns in a later period than the sale: reported in the period of the return.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST report sales by day, item, category, brand, staff, customer and payment mode, exportable to Excel (FR-RPT-001).
- **FR-002**: System MUST provide an exceptions report of cancels, edits, discounts over limit, below-cost, negative stock and returns without bill (FR-RPT-002).
- **FR-003**: System MUST report stock value at cost by location and category (FR-RPT-003).
- **FR-004 [V2]**: Expenses and owner drawings with categories (FR-RPT-004).
- **FR-005 [V2]**: Real profit with cost completeness (FR-RPT-005).
- **FR-006 [V2]**: Distributor scorecard (FR-RPT-006).
- **FR-007 [V3]**: Contractor ranking by contractor and referrer (FR-RPT-007).
- **FR-008 [V3]**: Price change impact (FR-RPT-008).
- **FR-009 [V3]**: Targets by shop, category and staff (FR-RPT-009).
- **FR-010 [V3]**: Customer area map by pin code for consenting parties only (FR-RPT-010).
- **FR-011 [V2]**: CA export of quarterly turnover, annual data, purchases register and Tally-compatible format with reminders 7 days before due dates (FR-CMP-004).
- **FR-012 [V2]**: Regular-scheme GSTR-1 and GSTR-3B exports (FR-CMP-014).
- **FR-013**: Every number in every report MUST trace to its source documents in 3 taps or fewer (NFR-015).

### Key Entities

- **Report Definition / Run**: Report type, filters, run time, result snapshot.
- **Expense / Drawing**: Category, amount, date, payment mode.
- **Profit Snapshot**: Period figures and cost completeness.
- **Scorecard / Ranking Row**: Per distributor or contractor measures.
- **Target**: Period, scope, goal.
- **Export Package**: Files, period, format, created time.
- **Compliance Calendar Item**: Due date and reminder.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A daily sales report loads in under 3 seconds for a day of 500 bills.
- **SC-002**: Report totals equal the sum of source documents for 100% of reports in a 20-report reconciliation.
- **SC-003**: The CA export for a quarter is produced in under 2 minutes and accepted by the CA without manual rework.
- **SC-004**: Margin leakage value (roll variance, rejected claims, below-cost sales) is visible monthly from V2.
- **SC-005**: Real profit shows a cost completeness figure on every run.

## Assumptions

- The Tally-compatible format is the one the shop's CA uses; the exact format is to be confirmed with the CA before building.
- Filing returns in the app is a non-goal; only exports are provided.
- Report charts (if any) follow the project's visual standard; the plan decides the chart library.
- Reports read from the same database as counter data; heavy reports may run on the server once sync exists (010).
