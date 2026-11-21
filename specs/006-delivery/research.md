# Research: Delivery

**Feature**: `specs/006-delivery/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD section 6 Delivery (FR-DLV-001 to 008), FR-BIL-022, FR-BIL-023, EC-16, the architecture reference sections 7.5 (delivery entities) and 11.2 (delivery state machine), the constitution v2.1.0, and the plans of 002 (items), 003 (bill versions, tenders, returns, inter-state check, unmet demand) and 005 (permissions, audit, cash sessions).

**Build order** (002 research D16): after 003, 008 and 007, from 2 to 22 August 2027. **Scope**: US1 to US3 (P1). US4 (partial delivery, driver phone view) is V2 and **not planned** (constitution VII). Phone proof of delivery needs feature 010; until then proof is entered at the counter (spec assumption).

## Decisions

### D1. A delivery belongs to the bill number, and records the version it was planned from

- **Decision**: `delivery` references the bill by `bill_no` (the document) and stores `planned_bill_version`. Because a same-day edit (003) makes a new bill version with the same number, the dispatch list compares the current version with the one the challan was printed from and shows "Bill changed after challan" (spec edge case).
- **Rationale**: pointing at a version row would leave a delivery attached to an old version after an edit.

### D2. Status history is append-only; the current status is derived

- **Decision**: `delivery_event(delivery_id, status, reason, driver_id, vehicle_id, occurred_at, user_id)`, append-only. Statuses follow the architecture's machine reduced to the spec's four words: `pending` (planned), `out_for_delivery`, `delivered`, `failed`; plus `rescheduled` (failed back to pending with a new date) and `closed_returned` (goods taken back through a return). The current status is the latest event. FR-009: "never delete earlier states".

- Allowed moves (core `nextDeliveryStatus`): `pending` or `rescheduled` to `out_for_delivery` (both need one driver and a vehicle); `out_for_delivery` to `delivered` (needs proof) or `failed` (needs a reason); `failed` or `rescheduled` to `closed_returned` (needs a complete return, below) and `failed` to `rescheduled` (new date). All other moves are refused.

### D3. The delivery charge is a non-stock bill line

- **Decision**: 002's `item_family.kind` gains `service`. A seeded service item "Delivery charge" has no stock movements (the stock rules skip `service` variants). When "To deliver" is ticked before saving, the charge line is added from the rate for the chosen area or distance band (`delivery_rate`). Waiving removes the line, needs the permission `delivery.waive` (new, 005; Owner and Manager allow, Counter request) and writes an audit entry with the waived amount. Service lines carry no cost, so 003's below-cost guard skips them and 011's cost completeness leaves them out (otherwise every delivery would show "Cost unknown").
- **Marking after save**: allowed, but without a charge line unless the bill is edited the same day (003's version flow adds the line). Rationale: adding a line to a saved bill otherwise breaks constitution I.
- **Distance**: by area name or a band label typed by the owner ("0 to 3 km"); no map routing (spec assumption).

### D4. Failed deliveries never invent a stock movement

- The sale movement already took the goods out of stock at bill save. A failed delivery that will be retried changes nothing in stock (the goods are the customer's, waiting in the shop). If the customer no longer wants them, "Take back" opens 003's return flow (a `sale_return` movement and a refund or credit note) and closes the delivery as `closed_returned` with that return ID. **Complete returns only**: `delivery.closeReturned` checks that the returns recorded against the bill (one or more) cover the full quantity of every goods line; otherwise it gives `RETURN_INCOMPLETE` and the delivery stays open, so the goods still with the shop can be dispatched or taken back later. Example: bill of 10 pipes and 2 elbows; the customer returns the 10 pipes only: the delivery stays `rescheduled` for the 2 elbows. On the same business day, an approved bill cancellation is also an option; how it closes the delivery is open (OI-4).

- **Rejected**: a delivery-specific stock movement (the architecture's `site_return` for "goods back to shop"). It would put goods back on sale while the bill still says they were sold.

### D5. Inter-state delivery under composition (EC-16)

The delivery address carries a state code. Saving a delivery whose state differs from the shop's home state while the registration is composition (008) is blocked by 003's `checkInterStateSale` with the explanation "A composition dealer cannot make inter-state sales". The owner may record a **referral**: an `unmet_demand` row (003) with `reason = 'referred_inter_state'`, the customer and the bill value. The bill's `place_of_supply_state` is set from the address (003 D14).

### D6. Cash on delivery

- **Decision**: the bill is saved with a tender `cod` (new mode, status `pending_collection`, 003's `bill_tender`). The driver's collection is a `tender_resolution` of kind `collected` (new kind) with the driver id and the amount; a collection in UPI is `collected` with mode `upi` and a reference (still checked for duplicates). Handing cash to the drawer is a `driver_handover` row plus a 005 `cash_entry` of kind `driver_handover` (new) in the open cash session.

- **Day close** lists cash activity per driver for the selected shop business date (US3 scenario 3). Attribute cash collections to the business date of the collection event in the shop's time zone, and handovers to their recorded `business_date`. The difference is cash collected minus cash handed in for that date. Open balances do not carry into later closes. Count a handover even when there is no collection for that driver on that date; it produces a negative difference. Raise one owner exception per driver at day close when the absolute difference strictly exceeds 005's variance alert.

- **Example**: bill ₹4,250 COD; driver collects ₹4,250 cash; hands in ₹4,000 at 7 pm: day close shows Driver Ramesh: collected ₹4,250, handed in ₹4,000, short ₹250.

### D7. Challan

A challan has its own number from 001's `number_series` with `doc_kind` `challan` (`DC{counter}/{fy}/{seq5}`, at most 16 characters), lists the bill number and version, the delivery address, contact, site, date and slot, the lines with quantities and units, and, when chosen, prices and totals. **Quantities still owed**: each line prints the bill line's quantity minus the returns recorded against it when the challan is made; a fully returned line is left out. Example: after the 10 pipes come back, the re-dispatch challan lists only the 2 elbows. The printed quantities are stored (`challan_line`), so a reprint shows the same paper. Every print is a `challan_print` row; any print after the first is marked "DUPLICATE" on the paper (spec edge case). The layout is in `contracts/challan-layout.md`.

### D8. Proof of delivery at the counter for now

`delivery_proof(delivery_id, receiver_name, photo_path, signature_path, delivered_at, entered_by, channel)`, channel `counter` now and `phone` with 010. A photo is picked from a file (for example sent by the driver on WhatsApp); a signature drawn on the counter screen is accepted but expected mainly on the phone later. SC-001 ("100% of delivered orders have a proof") is enforced: `delivered` needs a proof row.

### D9. Drivers and vehicles

`driver(name, phone, is_active)` and `vehicle(registration_no, label, is_active)`. A driver can be linked to a staff party (004, `party_type = 'staff'`) for advances, optional. One driver per delivery (spec edge case): the event's `driver_id` is single and the service refuses a second assignment while out.

### D10. Slots

`delivery_slot` setting: default Morning (9 to 12), Afternoon (12 to 4), Evening (4 to 8); the owner edits labels and times.

## Open items

| ID   | Item                                                                                                                                          | Resolve by                     | Milestone                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------- |
| OI-1 | Whether an e-way bill is ever needed for the shop's intra-state deliveries (value threshold and state rules); PRD and spec say not researched | Shop's CA                      | Before go-live of deliveries  |
| OI-2 | Delivery areas and charge bands                                                                                                               | Owner                          | M1                            |
| OI-3 | Whether the owner wants prices on the default challan                                                                                         | Owner                          | M1                            |
| OI-4 | Decide whether same-day cancellation creates a return accepted by `delivery.closeReturned` or needs a separate closure event and transition.  | Owner and 003/006 implementers | Before M2 dispatch completion |

## References

- CBIC, e-way bill rules (Rule 138 of the CGST Rules 2017) and the e-way bill portal: https://ewaybillgst.gov.in/ (primary; OI-1 left open because state thresholds and exemptions need the CA).
- Architecture reference sections 7.5 and 11.2 (`docs/reference/architecture.md`).
- Industry practice: Shopify keeps fulfilment status as a sequence of fulfilment events on an order rather than overwriting it (https://shopify.dev/docs/api/admin-rest/latest/resources/fulfillmentevent, primary vendor documentation). Delivery apps commonly capture a photo and receiver name as proof of delivery (for example Shiprocket and Onfleet product documentation, vendor marketing, secondhand). No reliable source was found on how Indian hardware shops reconcile driver cash; D6 follows the PRD.
