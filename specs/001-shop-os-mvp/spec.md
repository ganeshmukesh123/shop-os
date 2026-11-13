# Feature Specification: Shop OS MVP (Inventory + Basic Bill)

**Feature Branch**: `001-shop-os-mvp` (no git repository yet; directory name only)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "MVP is enter inventory and generate a basic bill (no tax and all)."

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
8. **Given** a payment mode (cash, UPI, or credit-note-free "unpaid") is chosen, **Then** it is stored on the bill (as a label only; no payment processing).

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

## Requirements *(mandatory)*

### Functional Requirements

**Inventory**

- **FR-001**: Users MUST be able to add an item with name, unit (pcs, metre, kg, litre, box, or custom), selling price and opening quantity.
- **FR-002**: Users MUST be able to edit an item's name, unit and price, and deactivate an item without deleting its history.
- **FR-003**: Users MUST be able to adjust stock by adding to or setting a quantity, and each change MUST be recorded with date and time.
- **FR-004**: System MUST show an item list with name, unit, price and current stock, searchable by partial name.
- **FR-005**: System MUST warn when adding an item whose name duplicates an existing one.
- **FR-006**: System MUST allow decimal quantities only for units that permit them (metre, kg, litre) and whole numbers only for pieces.
- **FR-007**: System SHOULD allow importing items from a spreadsheet file (name, unit, price, quantity), showing errors and duplicates before saving anything.

**Billing**

- **FR-008**: System MUST let users create a bill by searching items (2+ characters) and adding them with quantities.
- **FR-009**: System MUST let users change a line's quantity and price, remove a line, and apply a discount (₹ or %) to a line or the whole bill.
- **FR-010**: System MUST calculate line amounts and the grand total automatically, with no tax.
- **FR-011**: A customer name and phone MUST be optional on the bill.
- **FR-012**: System MUST record a payment mode label (cash, UPI, card, unpaid) on each bill, without processing payments.
- **FR-013**: System MUST assign each saved bill a unique, sequential bill number that is never reused, including for cancelled bills.
- **FR-014**: Saving a bill MUST reduce stock for each line; billing MUST NOT be blocked by insufficient stock, and negative-stock items MUST be flagged.
- **FR-015**: System MUST print the bill (receipt-size and A4/A5) or export it as a PDF, showing shop name, bill number, date, customer (if given), lines, discount and grand total, with no tax shown. A print failure MUST NOT prevent saving.
- **FR-016**: Users MUST be able to list, search (by number, date, customer) and reopen past bills and reprint them identically.
- **FR-017**: Users MUST be able to cancel a bill with a reason; cancelling MUST restore stock and keep the bill visible as Cancelled.
- **FR-018**: Saved bills MUST NOT be editable or deletable; corrections are made by cancelling and re-billing.
- **FR-019**: Users MUST be able to set the shop name, address and phone that appear at the top of the bill.

**Quality**

- **FR-020**: The app MUST work without an internet connection for all of the above, since data is stored on the device.
- **FR-021**: Data MUST be backed up automatically to a second location the owner can restore from.

### Key Entities

- **Item**: Name, unit, selling price, current stock, active flag.
- **Stock Change**: Record of an item's quantity moving up or down, with reason (opening, adjustment, sale, cancellation), date and time.
- **Bill**: Number, date and time, optional customer name and phone, payment mode label, discount, grand total, status (Saved or Cancelled), cancel reason.
- **Bill Line**: Item, quantity, unit, rate, line discount, line amount.
- **Shop Profile**: Shop name, address and phone shown on the bill.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user adds an item in under 30 seconds.
- **SC-002**: A 5-line bill is created, saved and printed in 60 seconds or less.
- **SC-003**: Item search shows results in under half a second with 5,000 items.
- **SC-004**: 100% of saved bills are retrievable after the app is closed and reopened, and none are lost or duplicated in a 2-week trial.
- **SC-005**: Stock shown after any sequence of bills and cancellations equals opening stock plus adjustments minus net sales, verified on a sample of 20 items.
- **SC-006**: A new staff member bills 5 lines unaided after 30 minutes of training.
- **SC-007**: Bill totals match a manual calculation on 100% of a 20-bill test set.

## Assumptions

- Scope is limited to inventory entry and basic billing. Deferred: tax and GST formats, customer credit/khata, parties, price tiers, returns, quotes, delivery, tinting, variants, multiple locations, approvals, roles and PINs, audit log, day-close, owner phone app, reports, WhatsApp sharing, cloud sync, multi-shop.
- A single shop, single counter, and a small number of trusted users; a login is not required in this MVP.
- Prices entered are the selling prices the customer pays; no tax is added or shown.
- Data is stored on the counter device (computer first); sync and the owner/godown phone apps come later, though the data should keep identifiers that allow it.
- Bill numbers are simple sequential numbers within a financial year; the format is chosen by the owner at setup (for example 000123).
- Payment mode on a bill is a label only; no UPI confirmation or credit ledger in this MVP.
- Opening stock is entered item by item or by spreadsheet import; the owner supplies the item list.
- A cancelled bill can be re-entered as a new bill; there is no editing of saved bills.
- Backup means an automatic local copy to a second drive or folder; cloud backup is a later add-on.
