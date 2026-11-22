# Quickstart: validating feature 003

Prerequisites: features 002, 004 and 005 merged (variants and tiers, parties and ledger, roles, PINs, approvals, audit log). Commands as in 001 (`pnpm dev`, `pnpm test`, `pnpm build && pnpm test:e2e`); e2e uses a throwaway `SHOPOS_USER_DATA`. Commands and codes: `contracts/ipc-commands.md`; keys: `contracts/keyboard-shortcuts.md`.

Test data: item "PVC Pipe 1 in" Retail ₹120, Contractor ₹110; party "Sharma Builders" (Contractor tier, party price ₹105 on the pipe, limit ₹50,000, balance ₹45,000); counter user with a 3% discount limit; owner PIN set; batch of "Paint 1 L" with MRP ₹450 and landed cost ₹300.

## 1. Keyboard billing and tiers (M2; US1)

1. Open the app. Expected: a new bill with the search box focused.
2. Type "pip 1", Enter. Expected: pipe added at quantity 1, ₹120.
3. Add 4 more lines by keyboard only; time it (SC-001, 45 s or less).
4. F7, pick a Contractor walk-in party. Expected: pipe reprices to ₹110, totals update; pick Sharma Builders. Expected: ₹105.
5. Hold 10 bills (F3); try an 11th. Expected: refused with "A counter can hold at most 10 bills"; recall one (F4).
6. Enter 2.5 on a sealed paint pack. Expected: rejected.

## 2. Price guards (M3; US2)

1. Sell the paint at ₹460. Expected: blocked, "Above MRP ₹450.00".
2. Sell at ₹290. Expected: approval requested; owner PIN approves; bill saves; the line carries the approval id. Repeat and reject; repeat and wait 2 minutes. Expected: the price reverts both times.
3. An item with no cost. Expected: "Cost unknown" badge, no approval asked.
4. Second batch with MRP ₹480 received later. Expected: the older batch (₹450) is picked; Ctrl+B switches.

## 3. Discounts and payments (M3; US3)

1. As the counter user give 5% off. Expected: approval needed; at 3%: allowed.
2. Bill ₹1,850, tender cash ₹2,000. Expected: change due ₹150.
3. Bill ₹2,000: cash ₹1,000 + UPI ₹1,000 without reference. Expected: QR with ₹1,000.00; bill saves; UPI Pending; listed by `tenders.pendingUpi`.
4. Enter the reference. Expected: Confirmed. Use the same reference on another bill. Expected: `DUPLICATE_REFERENCE`.
5. Pending UPI, customer pays cash instead. Expected: tender shows "Replaced by cash".
6. Sharma Builders credit bill ₹8,000. Expected: approval required (balance would be ₹53,000 over a ₹50,000 limit).

## 4. Returns (M4; US4)

1. Scan the QR on a printed 5-line bill in Return mode. Expected: its lines listed.
2. Return 2 of the 5 lines by credit note. Expected: ledger falls by the refund, stock returns to Shop floor; a credit note number is issued.
3. A pipe bought at ₹110 (contractor) returned by a retail customer. Expected: refund at ₹110 less its discount share, not ₹120.
4. Return without a bill. Expected: owner approval required.
5. Return a tinted line. Expected: approval required; stock goes to Tinted returns at the written-down value.
6. Time a return with a bill (SC-006, under 60 s).

## 5. Quotations (M5; US5)

1. Quote 3 lines, valid 7 days; share. Expected: PDF saved and WhatsApp opens with the message.
2. Revise it. Expected: version 2; version 1 viewable.
3. Convert 1 line on day 5 (clock moved in the test). Expected: quoted prices kept; other lines open.
4. Convert the rest on day 9. Expected: "Keep quoted prices" or "Refresh" asked.

## 6. Edit, cancel, unmet demand (M5; US6)

1. Bill C1/26-27/000123, 2 pcs x ₹120. Same day, a manager edits to 3 pcs. Expected: version 2 ₹360 with the same number; version 1 unchanged; stock +2 then -3; audit row with who, when and reason.
2. Next business day try to edit. Expected: refused; return or credit note offered.
3. Cancel with reason and owner approval. Expected: number kept; listed in exceptions.
4. Search "solar inverter" with no match; Ctrl+U. Expected: unmet demand recorded.
5. Remove a bill row in a test database copy and restart. Expected: the gap listed with reason "device crash".

## 7. Both themes and printing

Every new panel (tender, return, quote, versions, held bills) readable in System, Light and Dark; printed bills, returns and quotes black on white.
