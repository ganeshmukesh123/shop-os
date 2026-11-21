# Quickstart: validating feature 004

Prerequisites: 002 and 005 merged (tiers; roles, owner PIN, approvals). Commands as in 001. Commands and codes: `contracts/ipc-commands.md`.

## 1. Party ledger and credit limit (M2; US1)

1. Create contractor "Sharma Builders", phones 98765 43210 and 91234 56789, Contractor tier, limit ₹50,000, credit days 30, GSTIN from a real distributor bill.
2. Create another party with 98765 43210. Expected: warning "Same phone as Sharma Builders", saved.
3. Post an opening adjustment to reach ₹45,000 (with owner approval). Bill ₹2,000 on credit. Expected: warning "94% of credit limit used".
4. Bill ₹8,000 on credit. Expected: owner approval required; approve; the credit tender carries the approval id.
5. Move the clock so a bill is 45 days old (credit days 30). Expected: any new credit sale needs approval with "Overdue bill #C1/26-27/...".
6. Cancel a credit bill. Expected: a reversing entry; balance back.
7. Run `ledger.verify`. Expected: 0 mismatches (SC-004).

## 2. Ageing and payments (M3; US2)

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:72314e53a5c43cebafd9f15ce3c506952229ddbd9de1baa0cf2ceada7ec3d7a8 -->

1. Bills ₹3,000 (day 0), ₹5,000 (day 19), ₹2,000 (day 40); today is day 45.
2. Receive ₹6,000 cash with no bill selected. Expected: ₹3,000 to the first, ₹3,000 to the second; ageing shows ₹4,000 in 0-30 and ₹0 in 31-60.
3. Receive ₹1,000 UPI with reference; the same reference again. Expected: second refused `DUPLICATE_REFERENCE`.
4. Receive ₹500 against the ₹2,000 bill selected by hand. Expected: allocated there.
5. Receive ₹10,000 more than owed. Expected: advance shown as a negative balance; the next credit bill is settled from it.
6. Print and share the receipt. Expected: receipt number `RC1/26-27/00001`; WhatsApp opens with the message.

<!-- /coderabbit-ai-generated:v1 -->

## 3. Statements and reminders (M4; US3)

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:28931d7851b537f83e8ac9286248c9981d6e59fbcbb96b26f20be4529bbe073e -->

1. Send statement for 1 Jan to 31 Mar. Expected: PDF with opening balance first, entries, closing balance; WhatsApp opens with the balance and UPI link (2 taps from the party page, SC-002).
2. With 12 overdue parties, Send reminders with the Hindi template. Expected: 12 chats opened one by one with "Next"; 12 `reminder_log` rows; time the owner's effort (SC-003).
3. Withdraw one party's marketing consent. Expected: statement and reminder still prepared (transactional).
4. In a separate run with 50 overdue parties, complete the reminder flow and time the owner's effort. Pass if it takes strictly less than 2 minutes (SC-003).

<!-- /coderabbit-ai-generated:v1 -->

## 4. Opening balances import (M5; US4)

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:4a3728b78a8e211baf3d1f9aa628fe0e3015e1458480abb1b2db73d69aa01f60 -->

1. Import 100 parties with balances totalling ₹8,45,320.00, including 3 bad rows and 2 duplicate phones. Expected: preview lists them and the total of good rows.
2. Try to commit the preview with the 3 bad rows still present. Expected: `PREVIEW_HAS_ERRORS`, with nothing posted. Fix the 3 rows and preview the corrected file. Confirm its preview with a wrong total. Expected: `TOTAL_MISMATCH`, with nothing posted. Confirm with the corrected file's right total. Expected: one opening entry per imported party and a ledger total equal to the corrected file (SC-005).
3. Import the corrected file again. Expected: nothing new posted.

<!-- /coderabbit-ai-generated:v1 -->

## 5. Both themes

Party list, party page, ledger, ageing, payment, statement and import screens readable in System, Light and Dark; receipts and statements print black on white.
