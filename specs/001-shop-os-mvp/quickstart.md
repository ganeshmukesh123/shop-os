# Quickstart: validating Shop OS MVP

Run these once the milestone named beside each is complete. Commands assume the repository root after M0.

## Prerequisites
- Node.js 22 LTS and pnpm installed.
- `pnpm install` has been run.
- A printer with a driver installed (optional; PDF export works without one).

## Run
```bash
pnpm dev          # starts the desktop app with a throwaway dev database
pnpm test         # core and data-layer tests (Vitest)
pnpm test:e2e     # Playwright for Electron scenarios below
```

### Against the packaged app (task T062)
```bash
pnpm --filter @shopos/desktop package            # builds release/ (installer plus unpacked app)
pnpm --filter @shopos/desktop check:fuses        # the release build's fuses match spec 018
pnpm --filter @shopos/desktop package:e2e        # builds release-e2e/ (the flavour Playwright can drive)
pnpm --filter @shopos/desktop test:e2e:packaged  # the same specs, run against the packaged e2e binary
pnpm --filter @shopos/desktop test:e2e:packaged --offline   # macOS: also denies the app all non-loopback network
```
The specs cover scenarios 1 to 4 below and the PDF export. They use a throwaway data folder (`SHOPOS_USER_DATA`), so the owner's real data is never touched. What they cannot show: a second, clean computer, a real printer (scenario 2 print step, 5) and a restore drill by another person. Those stay manual.

## Scenarios

### 1. Inventory (after M2; spec US1)
1. Add 10 items with unit, price and opening quantity.
2. Edit one item's price and unit.
3. Adjust one item's stock with a note.
4. Search "pip" and confirm partial-name matches.
5. Try adding a duplicate name and confirm the warning.
6. Try 2.5 pcs and confirm rejection; try 2.5 metre and confirm acceptance.

Expected: list shows correct stock after each step; each stock change has a movement record.

### 2. Basic bill (after M3; spec US2)
1. Start a bill; type 2+ letters, press Enter, set quantities for 3 items.
2. Change one rate; apply a line discount and a bill discount.
3. Choose payment label and enter a customer name; save.

Expected: totals equal a manual calculation; bill number is the next in sequence; stock fell by each quantity; no tax shown anywhere.

### 3. Negative stock (after M3)
Bill more of an item than is in stock. Expected: the bill saves, stock goes below zero, and the item appears under "Needs correction".

### 4. Crash safety (after M3)
Build a bill, force-quit the app before saving, reopen. Expected: the draft is offered for recovery. Save a bill, force-quit immediately, reopen. Expected: the bill is present exactly once.

### 5. Print, list, cancel (after M4; spec US3)
1. Open the saved bill; print and export PDF; compare with `contracts/bill-layout.md`.
2. Search by number, date range and customer name.
3. Cancel with a reason.

Expected: reprint is identical; stock is restored; the bill stays listed as Cancelled and its number is not reused; saved bills offer no edit or delete.

### 6. Backup and restore (after M5 and T082 to T084)
Spreadsheet import moved to feature 012 (2026-11-15).
1. Set a backup folder and run a backup when the last bill is `C1/26-27/000120`.
2. Save 6 more bills (121 to 126); delete the local database; restore from the backup and enter "last issued: 126".

Expected: all items, stock and bills from the backup are present; the next bill is 127; 121 to 126 show as "Lost in restore" in the bill list.

### 6b. Decisions of 2026-11-15 (after M3b)
1. Bill lines totalling ₹849.60 with rounding on. Expected: round-off +₹0.40, grand total ₹850.00, both printed.
2. Print with the default settings. Expected: heading "Estimate", 80 mm receipt, no tax wording.
3. Set the computer's time zone to another zone, keep the shop setting `Asia/Kolkata`, save a bill at 23:50 IST on 31 March and another at 00:10 IST on 1 April. Expected: they fall in FY 26-27 and 27-28; a time-zone warning shows; billing is not blocked.
4. Switch System, Light and Dark in Settings. Expected: every screen is readable in both modes; the printed bill stays black on white.

### 7. Shop trial (M6)
Run alongside the paper book for 2 weeks. Check: no lost or duplicated bills, 20-item stock check matches, 20-bill totals match, 5-line bill under 60 seconds.
