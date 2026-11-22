# Quickstart: validating feature 008

Prerequisites: 002, 003, 004 and 005 merged (M0 needs only 004 and 005). Commands as in 001. Commands and codes: `contracts/ipc-commands.md`; printed content: `contracts/bill-formats.md`.

## 0. Consent and data requests (M0, 3 to 12 May 2027; US5 scenarios 2 to 4)

1. Create a customer. Expected: the notice is shown; the transactional tick is required; marketing is a separate tick; both stored with the notice version.
2. Withdraw marketing consent on the party page. Expected: new consent row; statements still prepared (004).
3. Access request. Expected: JSON and PDF of the party's data.
4. Erasure request for a party with zero balance. Expected: phones, address and GSTIN blank; name "Erased customer 7F3A"; bills unchanged and reprint identically. With a balance: "deferred: outstanding balance".

## 1. Bill format by registration (M2; US1)

1. Set composition from today. Bill. Expected: "Bill of Supply" with the declaration; no tax anywhere.
2. Add regular from next Monday 00:00. Bill today and on Monday (clock moved in the test). Expected: today a bill of supply, Monday a tax invoice with CGST and SGST; today's bill reprints unchanged.
3. Tax invoice to a party with a GSTIN. Expected: their GSTIN printed.
4. Generate 10,000 bills across the switch. Expected: no repeated number, none over 16 characters, a new series from the switch (SC-005).

## 2. HSN and dated rates (M2; US2)

1. Item HSN 8539, rate 12% until 21 Sep 2025 and 18% from 22 Sep 2025 (seed). Bill dated 21 Sep and 22 Sep (test clock). Expected: 12% then 18%.
2. Add a future rate change. Expected: bills before it use the old rate.
3. A line ₹1,180.00 at 18%. Expected: taxable ₹1,000.00, CGST ₹90.00, SGST ₹90.00; inter-state: IGST ₹180.00.
4. Item with no HSN on a tax invoice. Expected: bill saves; owner sees "missing HSN".

## 3. Turnover tracker and inter-state (M3; US3, US5 scenario 1)

1. Generate sales to 80%, 95% and 101% of ₹1.5 crore. Expected: warning, stronger warning, banner from the crossing date with "Talk to your CA" (SC-002).
2. Set the ₹75 lakh limit. Expected: levels recalculate.
3. Composition, delivery to another state. Expected: blocked with the explanation (003, 006).

## 4. Scheme-switch wizard (M4; US4)

1. Start a switch to regular for the 1st of next month with 3 items lacking HSN. Expected: checklist lists them; confirm disabled.
2. Fix them; review the closing-stock preview ("Purchase tax not recorded" until 009).
3. Review suggested prices with "keep final price"; edit two and confirm with the CA's name. Expected: the registration, series and audited prices are scheduled together. Move the test clock to the effective instant and check the new series, prices and final statement, including movements since confirmation through that instant. Time the wizard (SC-003, under 30 minutes).
4. Try to delete a bill or ledger entry with the `sqlite3` CLI on a test copy. Expected: refused (US6 scenario 1).

## 5. Both themes and print

Registration, rates, turnover, wizard and privacy screens readable in System, Light and Dark; bills of supply and tax invoices print black on white; check 50 bills in the trial (SC-001).
