# Quickstart: validating feature 009

Prerequisites: 002, 003, 004, 005, 007 and 008 merged. Commands as in 001. Commands and codes: `contracts/ipc-commands.md`.

Setup: distributor "Gupta Traders" (credit days 30); items A (last price ₹60), B, C; category target margin 20%.

## 1. Goods receipt with landed cost (M2; US1)

1. Draft a receipt from Gupta Traders: A 100 at ₹60 (₹6,000), B 50 at ₹60 (₹3,000), C 10 at ₹100 (₹1,000); freight ₹600 by value. Expected preview: shares ₹360, ₹180, ₹60; A landed ₹63.60 per unit.
2. Add line D: invoiced 20, received 18, damaged 3 (no freight share in this check: draft a second receipt). Expected: good 15, short 2.
3. An MCB (category requires ISI) without an ISI number. Expected: warning, not a block.
4. Post the first receipt. Expected: Godown +100 A, +50 B, +10 C; batches with MRP and landed cost; A's purchase price ₹63.60. Post the second. Expected: Godown +15 D, Defective +3 D. Time a 20-line receipt (SC-001, under 5 minutes).
5. Try editing the posted receipt. Expected: refused; return or adjust offered.

## 2. Purchase bill and payables (M3; US2)

1. Save a bill dated 1 Oct linked to two receipts. Expected: due 31 Oct; payable shown; a total that does not add up is refused.
2. A cash purchase without a GST bill. Expected: saved, flagged, cash out of the drawer.
3. Pay ₹5,000 by UPI. Expected: allocated to the oldest bill; ageing and "due this week" update; `ledger.verify` 0 mismatches (SC-004).

## 3. Price history and alerts (M4; US3)

1. Receive A at ₹63 with no charges (5% above ₹60). Expected: "Price up 5.0% from Gupta Traders"; landed ₹63.00; suggested selling ₹79 (₹63.00 / 0.8 = ₹78.75, rounded up to the rupee); accept it.
2. Receive A from a second distributor. Expected: comparison shows both, short-supply rate, delivery days, "No rolls yet".
3. 20 scripted receipts with 5 rises over 2%. Expected: 5 alerts (SC-003).

## 4. Purchase returns and debit notes (M5; US4)

1. Return the 3 damaged D from Defective plus the 2 short. Expected: Defective -3; debit note DN1/27-28/00001 for 5 units at D's landed cost; payable down.
2. Advance Raised to Sent to Accepted to Settled. Expected: each step logged with user and time; no skipping.

## 5. Warranty register (M5; US5 FR-010 data only)

1. Sell a drill (warranty 24 months, serial tracked) with serial DR12345. Expected: serial required; register row ending 24 months later.
2. Look up DR12345. Expected: "In warranty until <date>".

## 6. Both themes

Receipt, bill, payables, price history, return and warranty lookup screens readable in System, Light and Dark; debit notes print black on white.
