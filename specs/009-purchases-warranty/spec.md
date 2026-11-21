# Feature Specification: Purchases, Distributors and Warranty Claims

**Feature Branch**: `009-purchases-warranty`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Goods receipt from distributors with landed cost, purchase bills, distributor ledger, price history and alerts, purchase returns and debit notes, ISI/BIS capture, then warranty register, warranty cases, distributor claim profiles and pipeline, schemes and rebates, and purchase orders."

**PRD source**: `docs/reference/PRD.md` section 9 (FR-PUR-001 to 015), FR-ITM-014, FR-CMP-012, US-14, US-17, EC-08, EC-21, EC-22, BO-3.

**Depends on**: 001 (items, stock), 002 (ISI fields, warranty and serial flags), 004 (distributor parties and ledger), 007 (locations, rolls, licence meter), 008 (purchase GST per line).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Goods receipt with landed cost (Priority: P1)

The godown helper starts a receipt for a distributor, scans or picks items, enters quantities, batch, MRP and purchase price, marks short, excess or damaged lines, and adds freight, unloading, cartage and other charges. Charges are spread across lines by value (default) or quantity so item cost = purchase price + share of charges. Stock goes in and the item's cost updates.

**Why this priority**: Correct cost is the base of every margin number and of the below-cost guard.

**Independent Test**: Receive 3 lines with 600 freight; check the spread by value, new item cost, and stock increase.

**Acceptance Scenarios**:

1. **Given** a goods receipt from a distributor, **When** staff enter items, quantities, batch, MRP and purchase price, **Then** short, excess or damaged lines are recorded and validated.
2. **Given** 600 freight on a receipt, **When** landed cost is calculated, **Then** it spreads over lines by value (or by quantity if chosen) and updates each item's cost (US-14).
3. **Given** receipt confirmation, **When** saved, **Then** stock increases via purchase movements and the distributor ledger updates.
4. **Given** a BIS-mandatory electrical item, **When** received without an ISI/BIS number, **Then** a compliance warning shows.

---

### User Story 2 - Purchase bill and distributor ledger (Priority: P1)

A purchase bill links to one or more receipts, with the due date from the distributor's credit days; cash purchases without a GST bill are allowed and flagged. The distributor ledger shows purchases, returns, debit notes, payments and scheme credits, with ageing and a due-this-week list.

**Why this priority**: The owner must know what is owed to whom and when.

**Independent Test**: Link a bill to two receipts, see the due date and the distributor ageing, and record a payment.

**Acceptance Scenarios**:

1. **Given** a purchase bill, **When** linked to receipts, **Then** its payment due date is calculated from distributor credit terms.
2. **Given** a cash purchase without a GST bill, **When** entered, **Then** it is saved with an unbilled compliance flag.
3. **Given** the distributor ledger, **When** viewed, **Then** payables ageing and due-this-week amounts are displayed.
4. **Given** GST charged per purchase line, **When** recorded, **Then** it is stored for input tax credit tracking upon switching to regular GST (FR-CMP-012).

---

### User Story 3 - Price history and alerts (Priority: P1)

Every purchase price per item per distributor is kept. The system alerts when a new price is more than 2% (configurable) above the last and suggests a new selling price to keep the target margin. Distributor comparison shows last price, average delivery days, short-supply rate and roll variance.

**Why this priority**: Missed price rises silently kill margin.

**Independent Test**: Receive an item 5% above its last price; see the alert and a suggested selling price.

**Acceptance Scenarios**:

1. **Given** an item with purchase history, **When** a newly received rate is >2% above the previous price, **Then** an alert displays and suggests an updated selling price to preserve margin.
2. **Given** an item bought from multiple distributors, **When** comparison is viewed, **Then** historical purchase rates, delivery lead times, short-supply rates and roll variances are displayed.

---

### User Story 4 - Purchase returns and debit notes (Priority: P2)

Damaged, short or wrong goods are returned with a debit note linked to the original receipt, with status Raised, Sent, Accepted or Settled.

**Why this priority**: Prevents paying for goods the shop did not get.

**Independent Test**: Return 2 damaged units from a receipt; stock reduces, a debit note appears in the ledger and moves through statuses.

**Acceptance Scenarios**:

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:114256c67f77c12c50d5d0c07eeb80c47918719975f8a584585845743b5249ea -->

1. **Given** damaged or short goods from a receipt, **When** a return is created, **Then** only goods physically returned reduce stock. A debit note reduces the distributor balance. Across all returns for a receipt line, physical returns and short claims are bounded by the original received and short quantities, respectively.

<!-- /coderabbit-ai-generated:v1 -->
2. **Given** an active debit note, **When** status is updated through Raised, Sent, Accepted and Settled, **Then** each transition is logged with user and timestamp.

---

### User Story 5 - Warranty register, cases and claims (Priority: P2, V3)

Every sale of a warranty item stores sale date, customer, serial or batch (if tracked) and warranty end date. At the counter the sale is found and shown in or out of warranty; staff record the fault, give a replacement from sellable stock, and the faulty unit moves to the Defective bin as Pending claim. Distributor claim profiles hold settlement type (instant swap, credit note, monthly batch), claim window and proof required. Cases group into claims with statuses Pending, Sent, Approved or Rejected, Settled (swap, credit note or cash), with an alert 7 days before the window ends. Claims receivable show in the distributor ledger and real profit; rejected claims post as a loss with a reason.

**Why this priority**: A differentiator and a large leak; data is captured from the MVP so the history exists.

**Independent Test**: Replace a bulb under warranty, see it in the next claim batch, mark it settled by credit note and see the receivable clear.

**Acceptance Scenarios**:

1. **Given** a warranty-item sale, **When** committed, **Then** a warranty register entry is stored with start date, serial/batch, and coverage end date.
2. **Given** an eligible warranty claim, **When** staff issue a swap, **Then** the replacement departs sellable stock and the faulty unit moves to the Defective bin (US-17).
3. **Given** an open distributor claim, **When** the claim window ends in 7 days or less, **Then** an expiration alert displays; upon expiry, the case is marked lost and costed (EC-22).
4. **Given** a rejected distributor claim, **When** recorded, **Then** an inventory loss is posted with required explanation.

---

### User Story 6 - Schemes, rebates and purchase orders (Priority: P3)

Per-distributor slab or target schemes (for example 2% back above 5 lakh a quarter, or free goods) track progress and expected credit (V3). Purchase orders to distributors go over WhatsApp from the buying suggestion list (Later).

**Independent Test**: Configure a 2% rebate slab above ₹5,00,000 for a distributor; record qualifying purchases and verify expected credit accrues.

**Acceptance Scenarios**:

1. **Given** an active quarterly slab scheme, **When** purchase totals advance towards or cross threshold tiers, **Then** progress percentage and expected rebate credit are updated.

---

### Edge Cases

- Item with no purchase cost yet: below-cost check skipped with a "cost unknown" badge (EC-08).
- Receipt that would exceed a paint licence class: warns at 85% and blocks above 100% unless overridden with a reason (EC-21, with 007).
- Receipt edited after posting: not edited; corrected by a return or adjustment entry.
- Distributor price entered in a different pack size: unit conversion applies.
- Duplicate receipt of the same invoice: warned.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide goods receipt with distributor, items, quantities, batch, MRP and price, marking short, excess and damaged lines (FR-PUR-001).
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:de96058e55584f01bde97bd5aa353005ed23c8814760d93cb145b293ebead02c -->

- **FR-002**: System MUST allocate landed-cost charges by received value (default) or received quantity using largest remainder (floor each share, distribute leftover paise by descending fractional remainder, ties to earlier lines). Add allocated charges to the received line value before computing unit cost. Keep fully short lines for debit notes with zero allocated charges and no batch or unit cost (FR-PUR-002).

<!-- /coderabbit-ai-generated:v1 -->
- **FR-003**: System MUST provide purchase bills linked to receipts, due dates from credit days, and flagged cash purchases (FR-PUR-003).
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:73cbfeca311160663849f039b15f48836a3cc1853a9191073537f2e7b8846007 -->

- **FR-004**: System MUST keep a distributor ledger of purchases, returns, debit notes, payments and scheme credits with ageing and due-this-week (FR-PUR-004). A purchase bill’s open amount and ageing MUST reflect available debit note credits for its linked receipts, including notes posted before the bill.

<!-- /coderabbit-ai-generated:v1 -->
- **FR-005**: System MUST keep price history per item and distributor, alert above 2% (configurable) and suggest a selling price to keep the target margin (FR-PUR-005).
- **FR-006**: System SHOULD compare distributors on price, delivery days, short supply and roll variance (FR-PUR-006).
- **FR-007**: System MUST support purchase returns and debit notes with statuses Raised, Sent, Accepted, Settled (FR-PUR-007).
- **FR-008**: System MUST capture the ISI/BIS number on receipt for BIS-mandatory items and warn if missing (FR-PUR-008, FR-ITM-014).
- **FR-009 [V3]**: Schemes and rebates tracking (FR-PUR-009).
- **FR-010 [V3, data from MVP]**: Warranty register with sale date, customer, serial or batch, end date (FR-PUR-010).
- **FR-011 [V3]**: Warranty case with in or out of warranty, replacement and Defective bin hold (FR-PUR-011).
- **FR-012 [V3]**: Distributor claim profiles (FR-PUR-012).
- **FR-013 [V3]**: Claim pipeline with statuses and a 7-day window alert (FR-PUR-013).
- **FR-014 [V3]**: Claims receivable in the ledger and real profit; rejected claims posted as a loss (FR-PUR-014).
- **FR-015 [Later]**: Purchase orders over WhatsApp from buying suggestions (FR-PUR-015).
- **FR-016**: Purchase GST per line MUST be stored (FR-CMP-012).

### Key Entities

- **Goods Receipt / Receipt Line**: Distributor, items, quantities, batch, MRP, price, condition flags, charges.
- **Landed Cost Allocation**: Charges and their spread per line.
- **Purchase Bill**: Linked receipts, due date, GST per line, cash flag.
- **Distributor Ledger Entry**: Purchase, return, debit note, payment, scheme credit.
- **Price History**: Price per item, distributor, date.
- **Debit Note**: Return linked to a receipt with status.
- **Warranty Entry / Case / Claim / Claim Profile**: V3 warranty data.
- **Scheme**: Slab or target with progress.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A 20-line receipt with freight is posted in under 5 minutes.
- **SC-002**: Item cost equals price plus the allocated share for 100% of lines in a reconciliation of 20 receipts.
- **SC-003**: Every price rise over the threshold raises an alert in a 20-receipt test.
- **SC-004**: Distributor payables match the ledger sum for all distributors in a nightly check.
- **SC-005**: Claim recovery (value settled over value raised) reaches 90% or more after V3.

## Assumptions

- Distributors are parties of type Distributor created in 004.
- Landed cost spread by value is the default; quantity spread is chosen per receipt.
- The target margin used for suggested selling prices is an owner setting per category.
- BIS-mandatory item flags come from the BIS list, maintained by the product, not the shop.
- Warranty data capture at sale starts in 001/002 (period and serial flags) even though claims are V3.
