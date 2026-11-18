# Contract: printed bill formats (extends `specs/001-shop-os-mvp/contracts/bill-layout.md`)

Which format prints is decided by the registration in force at the bill's `billed_at` and stored on the bill (`doc_format`). Every field marked **(CA)** is drawn from secondary summaries of CGST Rules 46 and 49 and must be confirmed by the shop's CA before go-live (research OI-3). All formats print black on white; the 001 rules for quantities, wrapping and reprints apply.

## Estimate (before any registration is set; 001 behaviour)

Heading "Estimate"; no GSTIN, no tax wording.

## Bill of Supply (composition)

1. Heading "Bill of Supply".
2. Declaration directly under the heading: "composition taxable person, not eligible to collect tax on supplies" (FR-001; wording **(CA)**).
3. Shop legal name, trade name, address, GSTIN **(CA)**.
4. Bill number (at most 16 characters), date.
5. Customer name and address when known; party GSTIN when the party is registered **(CA)**.
6. Lines: description, HSN **(CA: whether HSN is required on a bill of supply at the shop's turnover)**, quantity with unit, rate, discount, amount.
7. Totals as 001 (lines total, bill discount, round-off, grand total). **No tax amount and no tax rate anywhere.**
8. Signature line "For <shop name>" **(CA)**.

## Tax Invoice (regular)

1. Heading "Tax Invoice".
2. Shop legal name, address, GSTIN, state name and code.
3. Invoice number (at most 16 characters), date; place of supply (state name and code) when different from the home state **(CA)**.
4. Recipient name, address and GSTIN when registered (FR-011); state name and code **(CA)**.
5. Lines: description, HSN, quantity with unit, rate, discount, taxable value, GST rate, CGST and SGST amounts (intra-state) or IGST amount (inter-state).
6. Tax summary by rate: taxable value, CGST, SGST or IGST per rate.
7. Totals: taxable value, CGST, SGST, IGST, round-off, grand total; total in words **(CA)**.
8. "Whether tax is payable on reverse charge: No" **(CA)**.
9. Signature line "For <shop name>, Authorised signatory".

## Version and cancel marks

- A bill with more than one version prints "Version 2" beside the number (003).
- A cancelled bill prints "CANCELLED" with the reason (001).

## Receipt width

On 58 mm and 80 mm receipts the tax summary by rate replaces the per-line tax columns to fit; per-line taxable value stays. A4 and A5 show every column.
