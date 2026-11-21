# Quickstart: validating feature 006

Prerequisites: 003, 004, 005 and 008 merged. Commands as in 001. Commands and codes: `contracts/ipc-commands.md`; challan: `contracts/challan-layout.md`.

Setup: rates "Old City ₹100", "0 to 3 km ₹150"; driver Ramesh; vehicle MH12 AB 1234; slots default.

## 1. Bill for delivery, charge and challan (M1; US1)

1. Bill 2 items for Sharma Builders, tick "To deliver", area Old City, tomorrow, Morning. Expected: a "Delivery charge ₹100.00" line; save; a pending delivery. Time it with the challan (SC-002, under 90 s).
2. As a Counter user tick "Waive charge". Expected: approval needed; the owner approves; the line is removed; the waiver is in the audit log.
3. Print the challan without prices, then with prices, then again. Expected: the third print says "DUPLICATE".
4. Address in another state while composition is set. Expected: blocked with the explanation; "Record as referral" saves an unmet-demand row.
5. Edit the bill the same day (003) after printing the challan. Expected: the dispatch list shows "Bill changed after challan".

## 2. Dispatch list and statuses (M2; US2)

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:e8c8901c9d3dad9472efac7c79a244f49e5957fc5992bd2711bced07d53de29c -->

1. Create 3 deliveries for tomorrow. Expected: all 3 listed for that date as Pending (SC-004).
2. Assign Ramesh and MH12 AB 1234 to one; try assigning a second driver. Expected: refused.
3. Dispatch it. Expected: Out for delivery.
4. Assign and dispatch the second delivery. Once it is Out for delivery, fail it with reason "Customer not home"; reschedule to the day after. Expected: history shows both events.
5. Assign and dispatch the third delivery. Once it is Out for delivery, fail it; "Take back" through a return. Expected: stock back via `sale_return`; delivery closed as returned.

<!-- /coderabbit-ai-generated:v1 -->

## 3. Proof and driver cash (M3; US3)

1. A COD bill of ₹4,250 delivered: enter receiver "Suresh" and a photo. Expected: Delivered; marking Delivered without proof is refused (SC-001).
2. Record ₹4,250 collected in cash by Ramesh; hand in ₹4,000. Expected: day close shows Ramesh collected ₹4,250, handed in ₹4,000, short ₹250, and an owner exception if above the alert.

## 4. Both themes

Delivery panel, dispatch list, proof and driver cash screens readable in System, Light and Dark; the challan prints black on white.
