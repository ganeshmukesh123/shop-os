# Contract: Printed bill layout

The same content is rendered for the 80 mm receipt (58 mm narrows the item column), A4 and A5. No tax lines or tax wording appear anywhere. Reprinting a bill produces identical output because item names and units come from the line snapshots.

## Header
1. Shop name (from Shop Profile), address, phone.
2. Bill number, date and time (local), payment mode label.
3. Customer name and phone, only if entered.
4. A "CANCELLED" banner and the reason across the bill when status is cancelled.

## Lines (one row per line, in entry order)
`#`, item name (wraps), quantity with unit, rate, line discount (only if non-zero), amount.

## Totals
1. Lines total.
2. Bill discount (only if non-zero).
3. **Grand total**, with amounts in rupees and paise using Indian grouping (for example ₹1,00,000.00).

## Footer
Shop footer text, then "Thank you".

## Rules
- Quantities show up to 3 decimals, trimmed (2.5 metre, not 2.500).
- A bill that does not fit on one receipt continues on a second page; totals appear on the last page only.
- Print failure leaves the saved bill untouched; the user can retry or export PDF from the bill view.
