# Feature Specification: Delivery

**Feature Branch**: `006-delivery` (no git repository yet; directory name only)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Deliver goods to customers and contractor sites: mark bills To deliver, delivery charges, challan, dispatch list with vehicle and driver, proof of delivery on a phone, driver cash reconciliation, then partial delivery and a driver view."

**PRD source**: `docs/reference/PRD.md` section 6 Delivery (FR-DLV-001 to 008), FR-BIL-022, FR-BIL-023, EC-16, US-16.

**Depends on**: 001/003 (bills), 004 (contractor sites for V2 site tagging), 005 (waive permission, day-close), 010 (phone app for proof of delivery). Until the phone app exists, proof can be entered at the counter.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mark a bill for delivery with a charge and challan (Priority: P1)

Staff mark a bill To deliver with address, contact, site (for contractors) and preferred date and slot. A delivery charge is added as a bill line using configured rates by area or distance band, and can be waived with permission. A delivery challan prints for the driver, with or without prices.

**Why this priority**: The shop delivers goods today; it cannot move off paper without it.

**Independent Test**: Make a bill To deliver with a band charge, waive it with permission on another, and print a challan with and without prices.

**Acceptance Scenarios**:

1. **Given** a bill, **When** marked To deliver, **Then** address, contact, optional site and date and slot are stored.
2. **Given** configured delivery bands, **Then** the charge line is added automatically by area or distance.
3. **Given** a user with permission, **Then** the charge can be waived and the waiver is logged.
4. **Given** the challan request, **Then** it prints with or without prices as chosen.
5. **Given** a delivery address outside the home state under composition, **Then** the sale is blocked with an explanation and the owner may record it as a referral (EC-16).

---

### User Story 2 - Dispatch list and statuses (Priority: P1)

The owner or manager sees deliveries by date with status Pending, Out for delivery, Delivered or Failed, and assigns a vehicle and driver.

**Why this priority**: Without a dispatch list, deliveries go missing.

**Independent Test**: Create 3 deliveries, assign drivers and vehicles, move each through statuses, and filter by date.

**Acceptance Scenarios**:

1. **Given** deliveries for a date, **Then** the list shows each with status, driver and vehicle.
2. **Given** a driver and vehicle are assigned, **Then** the delivery can be set Out for delivery.
3. **Given** a delivery fails, **Then** a reason is recorded and goods return to stock if needed.

---

### User Story 3 - Proof of delivery and driver cash (Priority: P1)

On a phone, the driver records receiver name, a photo of goods or a signature, and time. Cash collected on delivery is recorded against the driver and reconciled at day close.

**Why this priority**: Disputes and missing cash from deliveries are common.

**Independent Test**: Deliver an order with a photo and receiver name, record ₹ cash collected, and see it reconciled at day close.

**Acceptance Scenarios**:

1. **Given** a delivery, **When** completed on the phone, **Then** receiver name, photo or signature and time are stored with the delivery.
2. **Given** cash collected, **Then** it is recorded against the driver and added to the day-close reconciliation.
3. **Given** a driver's collected cash not handed in by day close, **Then** the difference is listed.

---

### User Story 4 - Partial delivery and driver view (Priority: P2, V2)

Deliver part of a bill or quote and track pending quantities (replaces FR-BIL-023). A driver view on a phone lists today's deliveries with map links.

**Independent Test**: Deliver 6 of 10 units, see 4 pending, and deliver the rest later.

**Acceptance Scenarios**:

1. **Given** a bill with 10 units to deliver, **When** 6 are delivered, **Then** 4 remain pending and show on the dispatch list.
2. **Given** a driver on a phone, **Then** today's deliveries and map links are shown.

---

### Edge Cases

- A bill edited after a challan printed: the challan shows a version and the dispatch list flags the change.
- Delivery cancelled after goods left: recorded as Failed with a reason and a return movement.
- Two drivers assigned to one delivery: refused; one driver per delivery.
- Challan printed twice: both are logged and marked duplicate.
- E-way bill requirement for the shop's deliveries: not yet researched; to confirm with the CA.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A bill MUST be markable To deliver with address, contact, site and preferred date and slot (FR-DLV-001).
- **FR-002**: Delivery charge MUST be added as a bill line by configurable area or distance bands and waivable with permission (FR-DLV-002).
- **FR-003**: System MUST print a challan with or without prices (FR-DLV-003).
- **FR-004**: System MUST provide a dispatch list by date with status Pending, Out for delivery, Delivered or Failed and vehicle and driver assignment (FR-DLV-004).
- **FR-005**: System SHOULD capture proof of delivery on a phone with receiver name, photo or signature and time; failures record a reason and return goods to stock when needed (FR-DLV-005).
- **FR-006**: Cash collected on delivery MUST be recorded against the driver and reconciled at day close (FR-DLV-006).
- **FR-007 [V2]**: Partial delivery with pending quantities (FR-DLV-007).
- **FR-008 [V2]**: Driver view on a phone with today's deliveries and map links (FR-DLV-008).
- **FR-009**: Delivery state changes MUST be audit-logged and never delete earlier states.

### Key Entities

- **Delivery**: Link to bill, address, contact, site, date and slot, status, driver, vehicle, charge.
- **Delivery Charge Band**: Area or distance band and rate.
- **Challan**: Printed document with version and price option.
- **Proof of Delivery**: Receiver, photo or signature, time, location note.
- **Driver / Vehicle**: People and vehicles available for dispatch.
- **Driver Cash Entry**: Cash collected and handed in per driver and day.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of delivered orders in the trial have a proof of delivery.
- **SC-002**: A delivery is created, charged and challan-printed in under 90 seconds.
- **SC-003**: Driver cash differences at day close stay within an agreed small amount.
- **SC-004**: The dispatch list shows every pending delivery for a date with zero missing in a spot check of 20.

## Assumptions

- Delivery charge bands are set by the owner; distance is by area name, not map routing, in the first release.
- Maps open as links; no live tracking.
- Phone proof of delivery needs the phone app (010); until then the manager enters proof from the counter.
- Whether an e-way bill is ever required is to be confirmed with the CA and is out of scope until then.
