# Quickstart: validating feature 011

Prerequisites: for M0, features 002 to 008 merged; for the rest, 009 as well. Commands as in 001. Commands and codes: `contracts/ipc-commands.md`.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:6c59436991149f7b5b838e4fdd70389ee803428ad1dc3903380acaea20d56608 -->

## 0. Core reports (M0, 13 to 26 Sep 2027; US1)

1. Generate a test day of 500 bills (scripted), with 3 cancels, 2 same-day edits, 4 over-limit discounts, 2 below-cost lines, 1 return without a bill and 2 negative-stock items.
2. Open Sales by day, item, category, brand, staff, customer and payment mode. Expected: each loads in under 3 seconds (SC-001); cancelled bills excluded; edited bills counted once at their current version.
3. Export Sales by item to CSV and, if the XLSX package is approved under 002 OD-2, also to Excel (XLSX). If the package is declined, CSV alone passes. Expected: each required file opens in Excel and includes both the rupee (two decimal places) and integer paise columns.
4. Exceptions report. Expected: every one of the risky events listed with its document.
5. Stock value at cost by location and by category. Expected: equals quantity x cost per item; items without cost flagged.
6. Tap a total, then a row, then a bill. Expected: the bill opens in 3 taps (FR-013).
7. Reconcile 20 report totals against their documents with a script. Expected: 100% equal (SC-002).

<!-- /coderabbit-ai-generated:v1 -->

## 1. Expenses and real profit (M1; US2)

1. Add rent ₹15,000 (bank), tea ₹500 (cash) and an owner drawing ₹5,000 (cash). Expected: cash entries in the drawer; drawing not counted as an expense.
2. Correct the tea expense. Expected: a negative correction row with the reason.
3. Real profit for the month. Expected: formula figures with "not tracked yet" for roll variance, rejected claims and write-offs; cost completeness under 100% when one sold item has no cost (SC-005).

## 2. CA export (M3; US3)

1. CMP-08 for Q1. Expected: turnover equals the turnover tracker (008); file produced in under 2 minutes (SC-003).
2. GSTR-4 data and the purchases register for the year. Expected: files produced; the CA opens them.
3. Tally file in the CA's format (OI-1). Expected: imports into the CA's Tally without manual rework.
4. Calendar 7 days before a due date. Expected: a reminder on the home screen.
5. For a regular-scheme test month: GSTR-1 (B2B by GSTIN, B2C by rate, HSN summary) and GSTR-3B. Expected: totals equal the bills' tax.

## 3. Distributor scorecard (M4; US4 FR-006)

View the scorecard for 3 months. Expected: price trend, delivery delay (proxy), short supply per distributor; roll variance and claim time "not tracked yet".

## 4. Both themes

Report, expense, profit, export and calendar screens readable in System, Light and Dark.
