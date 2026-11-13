# Feature Specification: Stock by Location, Counts, Reorder and Cut-Length Rolls

**Feature Branch**: `007-stock-locations-rolls` (no git repository yet; directory name only)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Stock by location (shop floor, godown, defective bin, racks), opening stock by rack, adjustments, negative-stock flagging, then cycle count, reorder, dead stock, roll tracking with length variance, paint licence meter, buying suggestions and outlet transfers."

**PRD source**: `docs/reference/PRD.md` section 7 (FR-STK-001 to 018), US-11, US-13, EC-02, EC-07, EC-13, EC-21, BO-4.

**Depends on**: 001 (movements, items), 002 (variants, petroleum class), 005 (approvals), 009 (receipts supply rolls and cost; licence meter checks receipts).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stock movements by location (Priority: P1)

Stock is worked out from permanent movements of these types: opening, purchase, sale, sale return, purchase return, adjustment, damage, warranty-out, warranty-in, transfer-out, transfer-in, site return and count correction. Each records item, optional batch, quantity, from and to location, linked document, user, device, time and a reason for adjustments. Locations per shop include at least Shop floor, Godown and Defective bin, plus user-defined racks.

**Why this priority**: This extends 001's single-location stock into the PRD's one trusted stock record by location.

**Independent Test**: Move 10 units from Godown to Shop floor and see both locations change and the total unchanged; sell from Shop floor; move 2 to the Defective bin.

**Acceptance Scenarios**:

1. **Given** a transfer between locations, **Then** one movement records from and to, and no total changes.
2. **Given** any movement, **Then** it cannot be edited or deleted.
3. **Given** stock lookup, **Then** quantity by location, last purchase price, last sale date and open rolls show.
4. **Given** a user-defined location such as rack R3 or a second godown, **Then** it can be created and used.

---

### User Story 2 - Opening stock by rack (Priority: P1)

A helper picks a rack, scans or searches items and enters counts, then marks the rack done; progress shows racks done versus total. Items not yet counted show "uncounted" instead of zero.

**Why this priority**: The shop's stock must be loaded rack by rack to reach 95% accuracy on the top 200 items by day 60.

**Independent Test**: Select rack R3, scan 25 items, enter counts, mark done; others remain "uncounted".

**Acceptance Scenarios**:

1. **Given** rack R3, **When** the helper scans 25 items with counts, **Then** they show counted and R3 shows done.
2. **Given** items not yet counted, **Then** they show "uncounted", not zero.
3. **Given** progress, **Then** racks done versus total show.

---

### User Story 3 - Adjustments and negative stock (Priority: P1)

A manual adjustment needs a reason from a list (damage, theft, count error, sample, personal use) and permission; adjustments above a value threshold need owner approval. Negative stock is allowed at the counter but flagged in the exceptions list for correction.

**Why this priority**: Sales must never be blocked by bad data, yet bad data must be fixed.

**Independent Test**: Sell the last unit on two offline counters and see stock -1 flagged; adjust with a reason; try a large adjustment needing approval.

**Acceptance Scenarios**:

1. **Given** an adjustment, **Then** a reason from the list and permission are required.
2. **Given** an adjustment above the value threshold, **Then** owner approval is required.
3. **Given** two counters sell the last unit, **Then** both save, stock goes to -1 and the exceptions list flags it (EC-02).
4. **Given** a scan of a barcode on two items, **Then** a chooser opens (EC-07).

---

### User Story 4 - Cycle count, reorder and dead stock (Priority: P2, V2)

The system proposes 1 rack or 20 items a day, weighted to high-value and fast-moving items; mismatches go to owner review before posting. Reorder levels (manual or suggested from average daily sales x lead time + safety days) feed a daily low-stock list grouped by distributor. Items with no sale in 90, 180 or 365 days show with stock value, filterable by distributor and category.

**Why this priority**: Keeps stock accurate and cuts stock-outs (BO-4: stock-out days on the top 100 items down 50%).

**Independent Test**: Run a proposed daily count, post a mismatch after review, and view the low-stock list and a dead-stock list.

**Acceptance Scenarios**:

1. **Given** the daily proposal, **Then** it lists 1 rack or 20 items weighted by value and speed.
2. **Given** a count mismatch, **Then** it goes to owner review before a count-correction movement posts.
3. **Given** average sales and lead time, **Then** a suggested reorder level shows and a low-stock list groups by distributor.
4. **Given** 90/180/365-day windows, **Then** dead stock lists with value.

---

### User Story 5 - Cut-length rolls (Priority: P2, V2)

Items flagged "sold by length from rolls" get a roll record on receipt with labelled length and roll ID (printable label). Billing suggests the open roll (oldest first) and a cut reduces its remaining length; optional start and end metre marks. Closing a roll takes the actual remaining length (often 0 or an offcut), records the variance against roll, item, batch and distributor, can keep an offcut as a new short roll, and recalculates cost per metre. Rolls untouched in 60 days or with variance above 2% are flagged.

**Why this priority**: This is a differentiator over generic apps and the PRD's margin-leak finding.

**Independent Test**: Bill 12 m from a 90 m roll, close it with a 3 m shortfall, see variance on the distributor and a new cost per metre.

**Acceptance Scenarios**:

1. **Given** a roll item received, **Then** a roll record with length and ID exists and a label prints.
2. **Given** billing 12 m, **Then** the suggested open roll's remaining length drops by 12.
3. **Given** a roll closed with actual remaining less than expected, **Then** variance records against roll, item, batch and distributor and cost per metre recalculates.
4. **Given** a cut longer than remaining, **Then** it is allowed, remaining goes negative and the roll is flagged (EC-13).
5. **Given** an offcut kept, **Then** a new short roll is created.

---

### User Story 6 - Paint licence meter, buying suggestions, transfers (Priority: P3)

Litres held per petroleum class per premises (stock x litres per unit) are compared with licence limits, warning at 85% on receipt or transfer and blocking above 100% unless the owner overrides with a reason (V2, only if needed). A weekly buying suggestion list uses sales speed, lead time, same month last year, pack sizes and distributor price (V3). Transfers between outlets with in-transit status and receive confirmation come Later.

**Independent Test**: Per increment, written when scheduled.

**Acceptance Scenarios**:

1. **Given** a receipt that would take class A paint over 100% of the licence, **Then** it is blocked unless the owner overrides with a reason (EC-21).
2. **Given** 85% reached, **Then** a warning shows on receipt or transfer.

---

### Edge Cases

- Count while sales happen: counts apply from a timestamp and later sales are not lost.
- Item deactivated with stock: allowed with a warning; stock stays visible.
- Roll cut recorded on the wrong roll: reversed by an opposite entry, never edited.
- Offcut smaller than a set length: option to discard with a reason.
- Negative stock on a roll item is flagged separately.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Stock MUST derive from permanent, unalterable movements of the listed types (FR-STK-001).
- **FR-002**: Every movement MUST record item, optional batch, quantity, from and to location, linked document, user, device, time and an adjustment reason (FR-STK-002).
- **FR-003**: System MUST support at least Shop floor, Godown and Defective bin plus user-defined locations (FR-STK-003).
- **FR-004**: Stock lookup MUST show quantity by location, last purchase price, last sale date and open rolls (FR-STK-004).
- **FR-005**: System MUST support opening stock by rack with progress and "uncounted" status (FR-STK-005).
- **FR-006**: Adjustments MUST need a listed reason and permission, with owner approval above a threshold (FR-STK-006).
- **FR-007**: Negative stock MUST be allowed at the counter and flagged for correction (FR-STK-007).
- **FR-008 [V2]**: Cycle count proposals and owner-reviewed posting (FR-STK-008).
- **FR-009 [V2]**: Reorder levels and daily low-stock list by distributor (FR-STK-009).
- **FR-010 [V2]**: Dead stock list at 90/180/365 days (FR-STK-010).
- **FR-011 [V2]**: Roll records with labelled length and printable roll ID (FR-STK-011).
- **FR-012 [V2]**: Open-roll suggestion, cut reducing remaining length, optional metre marks (FR-STK-012).
- **FR-013 [V2]**: Close roll with variance and offcut handling (FR-STK-013).
- **FR-014 [V2]**: Cost per metre recalculated on close and variance in margin and distributor reports (FR-STK-014).
- **FR-015 [V2]**: Roll flags at 60 days untouched or variance above 2% (FR-STK-015).
- **FR-016 [V2, if needed]**: Paint licence meter with 85% warning and 100% block with override reason (FR-STK-016).
- **FR-017 [V3]**: Weekly buying suggestions (FR-STK-017).
- **FR-018 [Later]**: Outlet transfers with in-transit status and receive confirmation (FR-STK-018).

### Key Entities

- **Location**: Named place in a shop.
- **Stock Movement**: Immutable record (from 001, extended with locations and types).
- **Count Session / Rack Count**: Counts per rack with status and progress.
- **Roll**: Item, batch, labelled length, remaining length, status, distributor.
- **Roll Cut / Roll Variance**: Cuts and the variance recorded at close.
- **Licence Limit**: Premises, petroleum class, litres limit.
- **Reorder Rule / Suggestion**: Per-item level and computed suggestions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Top-200 items' counts match the system within tolerance for at least 95% by day 60.
- **SC-002**: A 25-item rack is counted in under 10 minutes.
- **SC-003**: Stock-out days for the top 100 items fall 50% within 90 days of V2.
- **SC-004**: Roll variance is recorded for 100% of closed rolls and visible by distributor.
- **SC-005**: Stock after any sequence of movements equals the sum of movements in a nightly check, for all items.

## Assumptions

- Cycle count weighting uses sales value and sales speed from the last 90 days.
- Paint licence limits are read from the owner's licence document; the meter is built only if the Phase 0 discovery shows the shop needs it.
- Roll receipts depend on purchases (009); until then rolls can be created by the owner by hand.
- The average-daily-sales, lead-time and safety-day figures for reorder are owner-set defaults.
