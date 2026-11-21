# Research: Devices, Printing and Scanning

**Feature**: `specs/015-devices-printing-scanning/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD NFR-011, NFR-013, FR-BIL-015, FR-ITM-013, FR-DLV-005, FR-STK-011, EC-04, EC-07, section 15 (hardware dependency and the "hardware failure at counter" risk), the architecture reference sections 3 (receipts and labels row) and 12.1, 001 research D9 (HTML print through the OS dialog, raw ESC/POS deferred) and D24 (80 mm thermal printer, model unknown), the current `PrintService.ts` (OS dialog print and `printToPDF` behind a renderer port), and the plans of 002 (labels, barcode lookup), 007 (locations), 010 (phone apps, server restore), 012 (restore drill), 014 (Devanagari font) and 018 (hardening, signing).

**Build window**: 13 September to 3 October 2027 (002 research D16), or two weeks later if 011's OD-1 moves the core reports into September.

## Decisions

### D1. Print through the operating system driver; raw ESC/POS stays deferred

- **Decision**: keep 001's path: the bill is HTML, rendered by Chromium in a hidden window and sent to the OS driver with `webContents.print`. New here: **silent printing to a chosen printer** (`silent: true`, `deviceName` from the printer profile) so the counter does not see a dialog on every bill, the paper width from the profile (`pageSize` in microns for 58 or 80 mm), and per-bill-type defaults (receipt or A4 or A5, spec edge case "two printers").
- **Why not raw ESC/POS now**: raw printing needs a native module or OS-specific spooler calls (Windows raw printing has no Node built-in), adds a second layout to maintain, and cannot print Devanagari without rasterising. The driver path prints whatever Chromium renders, including Devanagari (014). FR-003's "fall back to the OS driver" is met because the driver path is the only path.
- **Revisit when**: the real-printer spike (001 T008) shows the driver cannot cut paper, is slower than SC-001's 3 seconds, or the shop's printer has no driver for one of the operating systems. Then ESC/POS becomes its own task with a package chosen with the owner.
- **Open item OI-1**: printer model, driver, paper width and cutter behaviour (001 D24). Everything about the receipt here is provisional until the spike.

### D2. What "print failed" can and cannot mean

The driver accepts a job long before paper comes out; out-of-paper is often not reported back to the app. So the app records every attempt in `print_log` (accepted by the spooler, failed with a reason, or cancelled), shows "Sent to printer" rather than "Printed", and always offers **Reprint** and **Share on WhatsApp** on the saved-bill screen (EC-04). The bill is committed before printing starts (constitution I), so no printer state can lose it (SC-002).

### D3. USB scanners as keyboard wedges, detected by timing

- A USB barcode scanner types characters very fast and ends with Enter. A renderer-wide listener treats a burst of at least 6 characters arriving less than 30 ms apart and ending with Enter as a scan, wherever focus is on the bill screen (spec US2 scenario 1: "without clicking a field first"), and routes it to 002's `items.lookupBarcode`. The thresholds are settings.
- When a text field has focus, keystrokes reach the field as usual, and the listener remembers the field's value from before the burst began. On the terminating Enter's keydown, if the burst meets the scan criteria, the listener calls `preventDefault` on that real (trusted) event, so no form submits, puts the field's earlier value back, and routes the code to the lookup. Otherwise Enter and every typed character reach the field unchanged, including Enter's normal action. Holding keys and replaying them is not used: scripted key events are untrusted (`isTrusted` is false), so a replayed Enter would not submit a form and replayed text would not reach React's inputs ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted)).
- **Limit**: a burst that meets the criteria counts as a scan whoever types it. Six characters under 30 ms apart is more than 33 characters a second, beyond hand typing, so hand-typed input is not expected to match; the thresholds are settings (`scanner_profile`) if a shop's scanner or staff need otherwise.
- Control characters and configured prefixes or suffixes are stripped (spec edge case).
- **Normalisation**: UPC-A (12 digits) is matched as EAN-13 with a leading zero; EAN-13 check digits are validated but a code with a wrong check digit is still looked up as typed (it may be a shop label); internal labels from 002 are Code 128 of the item code (`ITM-0042`).
- **Unknown barcode** (US2 scenario 4): a panel offers Search, Create item with this barcode, or Record as unmet demand (003).

### D4. Camera scanning lives in the phone apps

Camera scanning is in 010's Expo apps (`expo-camera` barcode scanning) with a torch toggle (spec edge case). The desktop counter does not use a webcam for scanning. SC-004 (95% of 50 trials in normal light) is measured on the shop's phone.

### D5. Labels and tags

002 built barcode labels and shelf tags as PDFs. This feature adds: label printer profiles (a separate printer and label size, printed silently like receipts), **location tags** for 007's racks (Code 128 of `LOC-<short code>`; scanning one in the count or move screens opens that location), and test labels that are scanned back (US3). **Roll labels** need 007's V2 rolls and are not planned.

### D6. Platforms

- **Desktop**: macOS first (owner), then Windows and Linux from the same code. electron-builder targets: DMG (mac), NSIS installer (Windows), AppImage and deb (Linux). Signing and notarisation are feature 018's US5; unsigned Windows builds show a SmartScreen warning until a certificate is bought (owner cost, OI-3).
- **Phones**: 010's owner and godown apps on Android phones, with large tap targets (NFR-011).
- **Android tablet as a counter** (US4 scenario 2, FR-001): this means building the whole counter (billing, items, khata, printing) in React Native, a second client of every screen. The architecture accepts that cost (two shells, section 13.3 risk) but it is far larger than this feature's window. **Owner decision OD-1**: plan the tablet counter as its own spec after the pilot; until then, a Windows or Linux laptop is the second counter device.

### D7. Second device takeover

A second computer with the app installed and registered is kept ready. If the main counter fails: on the second device, restore from the server (010's `restore.fromServer`) or, without internet, from the latest second-drive copy (001 backup), then bill. The drill is timed (SC-005, 30 minutes) and recorded with 012's restore drills. Power cuts during a save are already safe (one SQLite transaction in WAL mode, 001); a kill-during-save test is part of this feature's checks.

### D8. Health check

`hardware.health` reports: printers known to the OS (`webContents.getPrintersAsync`) and whether each profile's printer is present and idle; the last scan seen (a keyboard-wedge scanner cannot be detected until it sends input, so "last scan 2 minutes ago" is the honest signal); free disk space on the data drive (`fs.statfs`); last good backup (001's `backup_log`) and last cloud sync (010). Each problem has a plain next step ("Printer not found: check the cable and that it is switched on").

### D9. Recorded hardware

`printer_profile` and `scanner_profile` hold the model names typed by the owner, connection, paper width and defaults (FR-010), so support knows what the shop uses.

## Open items

| ID   | Item                                                                                                  | Resolve by         | Milestone |
| ---- | ----------------------------------------------------------------------------------------------------- | ------------------ | --------- |
| OI-1 | Receipt printer model, driver on each OS, 58 or 80 mm, cutter, Devanagari output (001 T008, 014 OI-3) | Real-printer spike | M1        |
| OI-2 | Scanner model and its suffix or prefix settings                                                       | Owner              | M2        |
| OI-3 | Windows code-signing certificate (cost) and macOS notarisation (018)                                  | Owner, 018         | M3        |
| OI-4 | Label printer or A4 label sheets (002 OI-6)                                                           | Owner              | M2        |

## Owner decisions needed

| ID   | Question                                                  | Recommendation | Needed by |
| ---- | --------------------------------------------------------- | -------------- | --------- |
| OD-1 | Android tablet counter as a separate spec after the pilot | Yes (D6)       | M1        |

## References

- Electron `webContents.print` (silent, deviceName, pageSize) and `getPrintersAsync`: https://www.electronjs.org/docs/latest/api/web-contents (primary).
- Node.js `fs.statfs`: https://nodejs.org/api/fs.html#fsstatfspath-options-callback (primary).
- GS1 General Specifications (EAN-13, UPC-A): https://www.gs1.org/standards/barcodes-epcrfid-id-keys/gs1-general-specifications (primary).
- electron-builder targets: https://www.electron.build/ (primary).
- Expo camera barcode scanning: https://docs.expo.dev/versions/latest/sdk/camera/ (primary vendor documentation).
- Industry practice: Shopify POS and Square treat USB scanners as keyboard input and recommend driver-based receipt printers with supported models lists (Shopify: https://help.shopify.com/en/manual/sell-in-person/shopify-pos/hardware, Square: https://squareup.com/help/us/en/article/5136, primary vendor documentation). Neither publishes how it distinguishes scanner input from typing; the timing method in D3 is a common practitioner approach (secondhand).
