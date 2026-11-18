# Quickstart: validating feature 014

Prerequisites: features 001 to 011 merged (their screens are moved to the catalogue). Commands as in 001, plus `pnpm text:check`. Contract: `contracts/text-catalogue.md`.

## 1. Text separate from code (M1; US1)

1. Run `pnpm lint` and `pnpm text:check`. Expected: no literal text in renderer JSX or print templates; every used key exists in English.
2. Add a test language file `xx.json` with 5 keys (test-only language code). Expected: those 5 show, everything else falls back to English, and `text.missing` lists the rest; no code changed (SC-001).
3. A key with placeholders whose order differs in the test language ("{amount} बाकी है {customerName} पर"). Expected: correct order.

## 2. Hindi in search and templates (M2; US2)

1. Item "Elbow 1 in" with search name "कोहनी". Type "कोहनी" and "कोहिनी" (one wrong vowel sign). Expected: found both times.
2. "Supreme कोहनी" found by "supreme" and by "कोहनी".
3. Run 50 searches by Hindi, Hinglish or trade name (scripted list from the owner). Expected: 95% pick the intended item in the top 3 (SC-002).
4. Send a reminder in Hindi and one in English (004). Expected: previews show the chosen text; 20 Hindi test sends arrive correctly formatted on two phones (SC-003).
5. Print an A4 bill with a Hindi customer name on macOS, Windows and Linux. Expected: no broken characters (bundled font).

## 3. Indian formats (M1; US3)

1. Show ₹12,34,567.50 on the bill screen, a report, a printed bill and a PDF. Expected: the same grouping everywhere.
2. Dates as 01-04-2027 on screens and "01 Apr 2027" on prints.
3. Export the sales report. Expected: amount columns are numbers in Excel, not text.
4. Run the scan for ungrouped amounts over every report and bill template. Expected: zero (SC-004).

## 4. Screen language (M3; US4)

1. Switch the helper to Hindi. Expected: their screens in Hindi; the counter user still in English; printed bills in the shop's bill language (English).
2. Hindi layout review on every screen: no clipped buttons or overflowing labels.
3. A Hindi-speaking staff member bills 5 lines unaided after the standard training (SC-005).
