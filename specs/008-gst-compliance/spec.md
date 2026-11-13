# Feature Specification: GST, Bill Formats and Compliance

**Feature Branch**: `008-gst-compliance` (no git repository yet; directory name only)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Both bill formats (composition Bill of Supply and regular Tax Invoice), registration setting with effective date, HSN and dated GST rate on every item, turnover tracker, scheme-switch wizard, inter-state rules, GSTIN handling, measuring-instrument reminders, DPDP consent, record retention, and later GSTR exports and simulator."

**PRD source**: `docs/reference/PRD.md` section 11 (FR-CMP-001 to 017), FR-BIL-014, FR-BIL-022, US-08, EC-15, EC-16, EC-17, EC-19.

**Depends on**: 001 (bills), 002 (HSN and GST rate fields), 003 (format selection), 004 (party GSTIN and consent). Exports for the CA are in 011.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct bill format by registration (Priority: P1)

Bills follow the registration in force on the bill date. Under composition the bill is a Bill of Supply with the header "composition taxable person, not eligible to collect tax on supplies" and no tax amount. Under the regular scheme it is a Tax Invoice with CGST and SGST by HSN rate. Registration, invoice series and tax settings are per shop.

**Why this priority**: Wrong bill wording or tax lines are a legal risk, and the shop may switch scheme.

**Independent Test**: Bill under composition and confirm the header and no tax; set a regular registration from a future date and confirm bills on and after that date use the tax invoice format while older bills are unchanged.

**Acceptance Scenarios**:

1. **Given** composition registration, **Then** a bill shows the required header and no tax amount (FR-CMP-001).
2. **Given** regular registration, **Then** a tax invoice shows CGST and SGST by HSN rate (FR-CMP-010).
3. **Given** a registration change with an effective date, **Then** bills from that date use the new format and past bills are unchanged (FR-CMP-002).
4. **Given** a regular-scheme invoice to a registered contractor, **Then** their GSTIN shows so they can claim credit (FR-CMP-016).
5. **Given** the serial number, **Then** it is consecutive, unique per financial year and at most 16 characters (letters, digits, hyphen, slash); a new series starts at a scheme switch.

---

### User Story 2 - HSN and dated GST rates on every item (Priority: P1)

Every item stores HSN and a GST rate from day one, even under composition. Rates are dated, so a rate change applies from its effective date.

**Why this priority**: This makes a later scheme switch a setting rather than a data migration.

**Independent Test**: Set a rate change with a future date and bill before and after it.

**Acceptance Scenarios**:

1. **Given** an item, **Then** HSN and GST rate are stored and editable with an effective date.
2. **Given** a bill dated before a rate change, **Then** the older rate applies.

---

### User Story 3 - Turnover tracker (Priority: P1)

The financial-year turnover is tracked against the composition limit (default 1.5 crore, configurable for 75 lakh states), with warnings at 80% and 95%. If the limit is crossed mid-year a banner appears from the crossing date and the owner is guided to the CA.

**Why this priority**: Crossing the limit without noticing is a compliance failure.

**Independent Test**: Load sales to 80%, 95% and over the limit and see each warning and the banner.

**Acceptance Scenarios**:

1. **Given** turnover at 80% of the limit, **Then** a warning shows; at 95%, a stronger one.
2. **Given** turnover crossing the limit, **Then** a banner shows from that date and the registration setting can be changed with an effective date (EC-15).
3. **Given** a 75 lakh state, **Then** the configured limit applies.

---

### User Story 4 - Scheme-switch wizard (Priority: P2)

The owner sets the effective date, starts a new invoice series, and gets a closing-stock statement with purchase tax for the credit claim when moving to regular (or the reversal when moving to composition), plus suggested new selling prices including GST. Forms and amounts are confirmed with the CA.

**Why this priority**: The owner may move between schemes, and doing it by hand is error-prone.

**Independent Test**: Run the wizard for a future date; check the new series, the closing-stock statement and the suggested prices.

**Acceptance Scenarios**:

1. **Given** the wizard, **When** the effective date is set, **Then** a new invoice series starts from that date.
2. **Given** a move to regular, **Then** a closing-stock statement with purchase tax is produced; **Given** a move to composition, **Then** the reversal is produced.
3. **Given** the suggested prices including GST, **Then** the owner may accept or edit them before applying.

---

### User Story 5 - Inter-state rule and consent (Priority: P1)

A composition dealer cannot sell inter-state: such a sale is blocked with an explanation, and the owner can record it as a referral. Inter-state sales (IGST) are allowed only under the regular scheme. At customer creation a plain-language privacy notice and consent tick are captured, with separate consent for marketing; consent can be withdrawn on the party page; export and erasure requests are handled while keeping bills the law requires. Live before 13 May 2027.

**Why this priority**: Legal duties start before go-live.

**Independent Test**: Try an inter-state delivery under composition (blocked); create a customer with and without marketing consent; withdraw and confirm marketing stops while bills remain.

**Acceptance Scenarios**:

1. **Given** composition and a delivery address outside the home state, **Then** the sale is blocked with an explanation (EC-16).
2. **Given** a customer created, **Then** notice, consent tick and separate marketing consent are captured.
3. **Given** consent withdrawn, **Then** marketing stops; transactional messages and bills remain (EC-17).
4. **Given** an erasure request, **Then** personal data is removed except what GST law requires to keep.

---

### User Story 6 - Records, reminders and exports (Priority: P2)

Bills and ledgers cannot be deleted and are kept at least 72 months from the annual return due date. Measuring tapes (every 24 months) and scales (every 12 months) have certificate dates with reminders (V2). CA export for CMP-08 and GSTR-4, purchases register and Tally-compatible format with reminders 7 days before due dates (V2, delivered in 011); regular-scheme GSTR-1 and GSTR-3B exports (V2, or earlier if the owner switches); GST simulator for regular versus composition over the last 12 months (V3).

**Independent Test**: Written when each is scheduled.

**Acceptance Scenarios**:

1. **Given** a deletion attempt on a bill or ledger, **Then** it is refused.
2. **Given** a tape certificate due in 30 days, **Then** a reminder shows.

---

### Edge Cases

- Turnover crossing the limit mid-year (EC-15).
- A bill number gap after a crash: listed with reason "device crash" for audit (EC-19).
- Scheme switch in the middle of a day: bills before the effective time use the old format.
- Item with no HSN at the switch: flagged and listed before the switch can finish.
- Customer withdraws consent: marketing stops, bills stay (EC-17).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Composition bills MUST carry the header "composition taxable person, not eligible to collect tax on supplies" and show no tax amount (FR-CMP-001).
- **FR-002**: System MUST provide a Registration setting (Composition or Regular) with an effective date; switching changes the format from that date and leaves past bills unchanged (FR-CMP-002).
- **FR-003**: System MUST track financial-year turnover against the composition limit (default 1.5 crore, configurable) with warnings at 80% and 95% (FR-CMP-003).
- **FR-004**: MRP cap MUST be enforced per batch (FR-CMP-005, FR-BIL-006).
- **FR-005**: System MUST capture DPDP consent with a plain-language notice, separate marketing consent, withdrawal from the party page, and handle export and erasure requests while keeping bills required by law; live before 13 May 2027 (FR-CMP-007).
- **FR-006**: Bills and ledgers MUST NOT be deletable and MUST be kept at least 72 months from the annual return due date (FR-CMP-008).
- **FR-007**: Both formats MUST exist and follow the registration in force on the bill date (FR-CMP-010).
- **FR-008**: Every item MUST store HSN and GST rate from day one, with dated rates (FR-CMP-011).
- **FR-009**: System MUST provide a scheme-switch wizard with effective date, new series, closing-stock statement and suggested GST-inclusive prices (FR-CMP-013).
- **FR-010**: Inter-state sales (IGST) MUST be allowed only under the regular scheme and blocked under composition (FR-CMP-015, FR-BIL-022).
- **FR-011**: Parties MUST store GSTIN and regular-scheme invoices to registered contractors MUST show it (FR-CMP-016).
- **FR-012**: Registration, invoice series and tax settings MUST be per shop (FR-CMP-017).
- **FR-013 [V2]**: CA export, measuring-instrument reminders, purchase GST per line, regular-scheme GSTR-1 and GSTR-3B exports (FR-CMP-004, FR-CMP-006, FR-CMP-012, FR-CMP-014).
- **FR-014 [V3]**: GST simulator (FR-CMP-009).
- **FR-015**: Bill numbers MUST be consecutive, unique per financial year and at most 16 characters, and gaps MUST be detected and listed.

### Key Entities

- **Registration**: Type (Composition or Regular), GSTIN, effective date, per shop.
- **Invoice Series**: Prefix, financial year, counter.
- **Tax Rate**: HSN, rate, effective date.
- **Turnover Snapshot**: Financial-year sales total versus limit.
- **Consent Record**: Notice version, consent flags, timestamps, withdrawals.
- **Scheme Switch**: Effective date, closing-stock statement, suggested prices, status.
- **Compliance Reminder**: Due date, kind and certificate dates.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of bills in a 2-week trial carry the correct format for their date, checked on a sample of 50.
- **SC-002**: The turnover warning appears at 80% and 95% in a test with generated sales.
- **SC-003**: A scheme switch is completed in under 30 minutes with the CA's forms checked.
- **SC-004**: Consent is captured for 100% of customers created after 13 May 2027, and consent withdrawal stops marketing within a day.
- **SC-005**: No bill number repeats or exceeds 16 characters in a 10,000-bill test.

## Assumptions

- The PRD says these rules were confirmed by Nov 2026 research; the shop's CA must confirm wording, limits, due dates and forms before go-live. The web research done for this project found bill-number and composition-header rules in secondary summaries only.
- Under the CGST rules summaries, gaps from cancelled invoices are acceptable if recorded; the CA confirms.
- Composition limit defaults to 1.5 crore; 75 lakh states are configurable.
- Filing GST returns inside the app is a non-goal; only exports are provided.
- Tax is calculated in this feature; before it, bills show no tax (001).
