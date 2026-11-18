# Contract: printed delivery challan

Printed on A5 (default) or A4, always black on white (constitution X). Thermal receipt width is not offered: drivers need room for a signature.

## Header

1. Title "Delivery Challan", and "DUPLICATE" across the top for every print after the first.
2. Shop name, address, phone.
3. Challan number (`DC1/27-28/00012`), date, bill number and "Version 2" when the bill has more than one version.
4. Deliver to: contact name, phone, address, area, site (if any), preferred date and slot.
5. Driver and vehicle (blank lines if not yet assigned).

## Lines

`#`, item name, quantity with unit (the entered unit and the base quantity when they differ, for example "2 roll (180 m)"). With prices: rate and amount. The delivery charge line appears only on the priced challan.

## Footer

- Priced challan: total, amount to collect on delivery (COD) or "Paid" or "On credit".
- Unpriced challan: "Amount to collect: ₹4,250.00" only when the bill is COD.
- Receiver name, signature, date and time lines.
- "Goods once delivered are checked at the door" (owner's wording, editable).

## Rules

- Quantities follow 001's format rules (up to 3 decimals, trimmed).
- The challan never shows tax lines (the tax document is the bill, feature 008).
