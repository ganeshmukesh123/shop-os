# Feature Specification: Shop OS MVP (Inventory + Basic Bill)

**Feature Branch**: `001-shop-os-mvp`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "MVP is enter inventory and generate a basic bill (no tax and all)."

**PRD source**: `docs/reference/PRD.md` (unchanged from the live doc, owner confirmed 2026-11-15) sections 1 (Decisions of 12 Nov 2026, Scope for a solo build), 5 (FR-ITM-003, FR-ITM-005, FR-ITM-007, FR-ITM-008, each in part), 6 (FR-BIL-001, FR-BIL-002, FR-BIL-005, FR-BIL-009, FR-BIL-010, FR-BIL-013, FR-BIL-015, FR-BIL-018, each in part), 7 (FR-STK-001, FR-STK-002, FR-STK-007), 11 (FR-CMP-001, FR-CMP-008, in part), 12 (NFR-001, NFR-002, NFR-004, NFR-005, NFR-006, in part), US-01, EC-01, EC-02, EC-04, EC-19, EC-20. "In part" means only the slice named in the requirement below; the rest stays with the later spec that owns it.

**Decisions of 2026-11-15** (owner answers to the audit; details in `research.md` D18 to D24): same-day bill edit is allowed from feature 005 (constitution v2.0.0), not in this release; printed document title is configurable and defaults to "Estimate"; spreadsheet import is out of this release; the schema moves to the architecture's shape now; prices are tax-inclusive and the grand total is rounded to the rupee by a setting; restored databases never reuse bill numbers; the business time zone is a shop setting (default Asia/Kolkata); the receipt default is 80 mm and stays configurable.

**Scope note**: This replaces the earlier, much larger MVP draft. The full requirements document remains the long-term roadmap; everything not listed here is deferred.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enter inventory (Priority: P1)

The shop owner or staff add items to the shop's inventory: name, unit, selling price, and opening quantity. They can edit an item, correct its quantity, and see the current list with stock levels.

**Why this priority**: Nothing can be billed until items exist. This is the foundation.

**Independent Test**: Add 10 items with price and quantity, edit one, and find another by typing part of its name. The list shows the right stock for each.

**Acceptance Scenarios**:

1. **Given** the inventory is empty, **When** the user adds an item with name, unit, selling price and quantity, **Then** it appears in the list with that stock.
2. **Given** an existing item, **When** the user edits its name, price or unit, **Then** the change is saved and shown in the list.
3. **Given** an existing item, **When** the user corrects its quantity (add or set), **Then** stock updates and the change is recorded with a time.
4. **Given** a typed search "pip", **When** the list is filtered, **Then** all items whose name contains it appear.
5. **Given** an item name already exists, **When** the user tries to add the same name, **Then** the system warns about the duplicate before saving.
6. **Given** a unit like metre or kg, **When** quantities are entered, **Then** decimals are accepted; for unit "pcs" only whole numbers are accepted.

---

### User Story 2 - Generate a basic bill (Priority: P1)

Staff start a bill, search and add items, set quantities, optionally change a line's price or give a discount, enter the customer name (optional), and save. The bill gets a number, stock reduces, and the bill can be printed or saved as a shareable PDF. There is no tax on the bill.

**Why this priority**: This is the product's purpose: replacing the paper bill book.

**Independent Test**: Add 3 items to a bill with quantities, save, and confirm the bill total is correct, the bill number is unique and in sequence, stock decreased, and the bill prints.

**Acceptance Scenarios**:

1. **Given** items in inventory, **When** staff type 2+ letters in the bill search, **Then** matching items appear and Enter adds the top match with quantity 1.
2. **Given** lines on the bill, **When** quantity or price is changed, **Then** line totals and the bill total update immediately.
3. **Given** a discount (₹ or %) on a line or the whole bill, **When** applied, **Then** the total reflects it and it is shown on the printed bill.
4. **Given** a bill with lines, **When** staff save, **Then** the bill receives the next sequential number, stock reduces by each line's quantity, and the bill is stored.
5. **Given** a saved bill, **When** staff choose Print or Save PDF, **Then** a bill shows shop name, bill number, date, customer name (if any), lines (item, quantity, unit, rate, amount), discount, and grand total, with no tax shown.
6. **Given** an item has less stock than the quantity billed, **When** staff save, **Then** the sale is still allowed, stock goes negative, and the item is flagged for correction.
7. **Given** the printer is unavailable, **When** a bill is saved, **Then** the bill is still saved and can be reprinted later.
8. **Given** a payment mode (cash, UPI, card or unpaid) is chosen, **Then** it is stored on the bill (as a label only; no payment processing).
9. **Given** a bill whose lines total ₹849.60 and rounding is on, **When** it is saved, **Then** a round-off of +₹0.40 is stored and printed and the grand total is ₹850.00.
10. **Given** the document title setting is "Estimate" (the default), **When** a bill is printed, **Then** the heading reads "Estimate" and no tax wording appears.

---

### User Story 3 - Find and reprint past bills (Priority: P2)

Staff and owner view the list of past bills (by date, bill number or customer name), open any bill, and reprint it. A same-day mistake is handled by cancelling the bill, which returns stock and keeps the bill number visible as cancelled.

**Why this priority**: Customers ask for duplicates, and mistakes happen; without this the system cannot replace the paper book.

**Independent Test**: Save a bill, find it by number and by customer name, reprint it, then cancel it and confirm stock returns and the bill shows as cancelled.

**Acceptance Scenarios**:

1. **Given** saved bills, **When** the user searches by bill number, date range or customer name, **Then** matching bills list.
2. **Given** a bill is opened, **When** Print is chosen, **Then** the output is identical to the original.
3. **Given** a bill is cancelled with a reason, **Then** stock for each line is restored, the bill remains in the list marked Cancelled, and its number is never reused.

---

### Edge Cases

- Bill saved with zero lines: not allowed.
- Quantity zero or negative on a bill line: not allowed.
- Price changed below zero or discount larger than line amount: not allowed.
- Item deleted that appears on past bills: items are deactivated, not erased, so old bills stay intact.
- Two bills saved in quick succession: numbers stay unique and sequential.
- App closed or power lost mid-bill: a saved bill is never lost; an unsaved draft is recovered on reopen where possible.
- Item with no stock recorded: can still be billed (stock goes negative and is flagged).
- Very long item lists (thousands of items): search remains fast.
- Database restored from an older backup: the next bill number continues after the last number actually issued, never reusing one (EC-19).
- Bill saved at 11:50 pm on 31 March: it belongs to the financial year of its business date in the shop's time zone, whatever the device's time zone is.
- Device clock behind the last saved bill or in a different time zone: billing continues, and a warning is shown (EC-20).

## Requirements *(mandatory)*

### Functional Requirements

**Inventory**

- **FR-001**: Users MUST be able to add an item with name, unit (pcs, metre, kg, litre, box, or custom), selling price and opening quantity (PRD FR-ITM-003 in part: base unit, selling price, active flag). Each item is stored as a family with one variant, so variant grids (feature 002) need no data move (research D18).
- **FR-002**: Users MUST be able to edit an item's name, unit and price, and deactivate an item without deleting its history (PRD FR-ITM-003 in part).
- **FR-003**: Users MUST be able to adjust stock by adding to or setting a quantity, and each change MUST be recorded with date and time (PRD FR-STK-001, FR-STK-002 in part: item, quantity, location, reason, user-free device and time; one default location "Shop floor").
- **FR-004**: System MUST show an item list with name, unit, price and current stock, searchable by partial name (PRD FR-ITM-007 in part: substring match on name; typo tolerance, barcodes and sales ranking are feature 002).
- **FR-005**: System MUST warn when adding an item whose name duplicates an existing one (PRD FR-ITM-008 in part: same name).
- **FR-006**: System MUST allow decimal quantities only for units that permit them (metre, kg, litre) and whole numbers only for pieces (PRD FR-ITM-005).
- **FR-007**: *Deferred (owner decision 2026-11-15)*. Spreadsheet import of items is out of this release and moves to feature 012 (PRD FR-ITM-012). Opening stock is entered item by item.

**Billing**

- **FR-008**: System MUST let users create a bill by searching items (2+ characters) and adding them with quantities; Enter adds the top match at quantity 1 (PRD FR-BIL-001, FR-BIL-002 in part: no variant grid, US-01).
- **FR-009**: System MUST let users change a line's quantity and price, remove a line, and apply a discount (₹ or %) to a line or the whole bill (PRD FR-BIL-005 in part: no staff discount limit until feature 005).
- **FR-010**: System MUST calculate line amounts and the grand total automatically, with no tax added or shown. Entered prices are the final, tax-inclusive prices the customer pays (PRD FR-CMP-001 in part; research D20).
- **FR-010a**: System MUST round the grand total to the nearest rupee (50 paise and above rounds up) when the shop setting "Round bill total" is on (default on), storing and printing the difference as a separate round-off amount; lines keep exact paise (research D20).
- **FR-011**: A customer name MUST be optional on the bill. Customer phone is intentionally not captured in this release (decision of 2026-11-13, review B4/B6). The name, if given, is part of the stored bill and is retained with it (research D19) (PRD FR-BIL-009 in part, FR-CMP-007).
- **FR-012**: System MUST record a payment mode label (cash, UPI, card, unpaid) on each bill, without processing payments (PRD FR-BIL-010 in part).
- **FR-013a**: Saving the same bill twice (double-click, retry, crash-and-retry) MUST NOT create a second bill or a second stock movement; the first bill is returned (Constitution Principle I, PRD NFR-005, SC-004).
- **FR-013**: System MUST assign each saved bill a number that is consecutive and unique within its series and financial year, at most 16 characters (letters, digits, hyphen, slash), formatted from the shop's template (default `C1/26-27/000123`), and never reused, including for cancelled bills (PRD FR-BIL-013, constitution Compliance constraints).
- **FR-013b**: After a restore from backup, the system MUST NOT issue a bill number that was already issued: the owner confirms the last number issued before the restore, numbering continues after it, and the skipped numbers are recorded with the reason "lost in restore" (PRD EC-19; research D21).
- **FR-014**: Saving a bill MUST reduce stock for each line; billing MUST NOT be blocked by insufficient stock, and negative-stock items MUST be flagged (PRD FR-STK-007, EC-02).
- **FR-015**: System MUST print the bill on a thermal receipt (80 mm default, 58 mm option) or A4/A5, or export it as a PDF, showing the document title, shop name, bill number, date, customer (if given), lines, discount, round-off (if any) and grand total, with no tax shown. A print failure MUST NOT prevent saving (PRD FR-BIL-015 in part: no WhatsApp share, EC-04; research D24).
- **FR-015a**: The printed document title MUST be a shop setting, defaulting to "Estimate" (research D23). Until feature 008 adds the composition Bill of Supply format, the shop's paper bill book stays the legal bill.
- **FR-016**: Users MUST be able to list, search (by number, date, customer) and reopen past bills and reprint them identically (constitution I; supports PRD FR-BIL-019 and EC-04 later).
- **FR-017**: Users MUST be able to cancel a bill with a reason; cancelling MUST restore stock, keep the number and keep the bill visible as Cancelled (PRD FR-BIL-018 in part: no owner approval until feature 005).
- **FR-018**: Saved bills MUST NOT be editable or deletable in this release; corrections are made by cancelling and re-billing. Same-day editing as a new version is feature 003 with 005 (PRD FR-BIL-017, Constitution Principle I v2.0.0).
- **FR-019**: Users MUST be able to set the shop name, address and phone that appear at the top of the bill.
- **FR-019a**: The shop's business time zone MUST be a setting (default `Asia/Kolkata`). Each bill stores the UTC time it was saved and the business date in that zone; the financial year and "same day" rules use the business date, never the device's time zone. If the device's clock or time zone disagrees, the app warns and keeps billing (PRD EC-20 in part; research D22).

**Quality**

- **FR-020**: The app MUST work without an internet connection for all of the above, since data is stored on the device (PRD NFR-004, Constitution Principle IV).
- **FR-021**: Data MUST be backed up automatically to a second location the owner can restore from (PRD NFR-006 in part: local copy, no cloud).

### Key Entities

- **Item family and item variant**: what the shop sells. In this release every family has exactly one variant holding name, unit, selling price, decimal rule and active flag.
- **Location**: where stock is held. One location, "Shop floor", in this release.
- **Stock movement**: an item's quantity moving into or out of a location, with type (opening, adjustment, sale, sale cancel), date and time.
- **Bill**: number, business date and time, optional customer name, document title, discount, round-off, grand total, status (Posted or Cancelled), cancel reason.
- **Bill line**: item variant, quantity, unit, rate, line discount, line amount.
- **Bill tender**: how the bill was paid, as a label (cash, UPI, card, unpaid) with its amount.
- **Number series**: the counter's bill number sequence for one financial year, including numbers recorded as lost in a restore.
- **Shop profile**: shop name, address, phone, document title, number template, rounding setting, time zone and receipt width.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user adds an item in under 30 seconds.
- **SC-002**: A 5-line bill is created, saved and printed in 60 seconds or less (initial MVP target; PRD Section 15 leading metric aims for 45 s or less with experienced counter staff).
- **SC-003**: Item search shows results in under half a second with 5,000 items (this release's baseline; the PRD target of about 0.2 s over 50,000 items, NFR-001, is verified by feature 016).
- **SC-004**: 100% of saved bills are retrievable after the app is closed and reopened, and none are lost or duplicated in a 2-week trial.
- **SC-005**: Stock shown after any sequence of bills and cancellations equals opening stock plus adjustments minus net sales, verified on a sample of 20 items.
- **SC-006**: A new staff member bills 5 lines unaided after 30 minutes of training.
- **SC-007**: Bill totals match a manual calculation on 100% of a 20-bill test set.

## Assumptions

- Scope is limited to inventory entry and basic billing. Deferred: tax and GST formats, customer credit/khata, parties, price tiers, returns, quotes, delivery, tinting, variants, multiple locations, approvals, roles and PINs, audit log, day-close, owner phone app, reports, WhatsApp sharing, cloud sync, multi-shop.
- A single shop, single counter, and a small number of trusted users; a login is not required in this MVP.
- Prices entered are the tax-inclusive selling prices the customer pays; no tax is added or shown. A composition dealer cannot collect tax and MRP already includes all taxes (to confirm with the CA).
- Data is stored on the counter device (computer first); sync and the owner/godown phone apps come later. Tables use the architecture's names and shape from this release (research D18), so those features add rows and columns, not a data move.
- Bill numbers are consecutive within a series and financial year; the template is chosen by the owner at setup (default `C1/26-27/000123`).
- Payment mode on a bill is a label only; no UPI confirmation or credit ledger in this MVP.
- Opening stock is entered item by item; the owner supplies the item list. Spreadsheet import is a later feature.
- A cancelled bill can be re-entered as a new bill; there is no editing of saved bills in this release.
- During the counter trial the printout is an "Estimate" and the paper bill book remains the legal bill (research D23).
- The shop's receipt printer is an 80 mm thermal printer; the width stays a setting (58 mm, 80 mm, A4, A5). The exact model is still to be tested.
- Backup means an automatic local copy to a second drive or folder; cloud backup is a later add-on.
