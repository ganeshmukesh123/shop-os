# Quickstart: validating feature 015

Prerequisites: 001's printer spike (T008) done; 002, 007, 010 and 014 merged. A real receipt printer, an A4 printer (or PDF), a USB scanner and an Android phone. Commands and codes: `contracts/ipc-commands.md`.

## 1. Print bills (M1; US1)

1. Add a receipt profile (80 mm, silent) and an A4 profile. Print the test page. Expected: Hindi line prints correctly or the profile is marked "Cannot print Devanagari".
2. Save and print a 5-line bill 20 times. Expected: paper out within 3 s of save each time (SC-001), right width, cut or feed correct.
3. Print the same bill on A4. Expected: the same content in the larger layout.
4. Unplug the printer and save 20 bills. Expected: every bill saved (SC-002); "Could not send to printer" with Retry, Share on WhatsApp and Reprint later; reprint after reconnecting.
5. On a printer marked "Cannot print Devanagari", print a bill with a Hindi customer name. Expected: the user is told and the bill prints with the English fallback.

## 2. Scan items (M2; US2)

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:366632f889cde37f2457f475841ae2b866d421d8b138121a9ba89b3857c46f8e -->

1. With focus anywhere on the bill screen, scan 10 items with the USB scanner. Expected: each added in under 1 s (SC-003); typing a name by hand is never treated as a scan.
2. Scan a UPC-A product whose barcode is stored as EAN-13. Expected: found.
   - Store only UPC-A `036000291452` on an item. Scan with the scanner sending EAN-13 `0036000291452`. Expected: the item is added to the bill and the unknown-barcode panel stays closed.
3. Scan a barcode on two items. Expected: chooser and one data issue (002).
4. Scan an unknown code. Expected: Search, Create item with this barcode, or Record as unmet demand.
5. In the godown app (010), scan 50 barcodes in normal shop light with the torch off and on. Expected: 95% read (SC-004).

<!-- /coderabbit-ai-generated:v1 -->

## 3. Labels and tags (M2; US3)

Print labels for 10 items and tags for 3 racks; scan them back. Expected: items found; a rack tag opens that location in the count screen.

## 4. Platforms and takeover (M3; US4)

1. Install on macOS, Windows and Linux; open, bill, print to PDF on each.
2. Drill: the main counter "fails"; on the second laptop restore (server, or second-drive copy offline) and bill. Expected: within 30 minutes (SC-005).
3. Kill the app during a bill save 20 times. Expected: each bill either complete or absent, never partial.

## 5. Health check (M3; US5)

Disconnect the printer, fill the disk near the warning level, skip a backup. Expected: three problems with plain next steps.

## 6. Both themes

Printer, scanner, labels and health screens readable in System, Light and Dark; every printed output black on white.
