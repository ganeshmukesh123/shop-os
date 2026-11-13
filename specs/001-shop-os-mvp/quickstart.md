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

### 6. Import and backup (after M5)
1. Import a spreadsheet containing errors and duplicates; review the preview; confirm.
2. Set a backup folder and run a backup; delete the local database; restore from the backup.

Expected: nothing is saved before confirming; after restore, all items, stock and bills are present.

### 7. Shop trial (M6)
Run alongside the paper book for 2 weeks. Check: no lost or duplicated bills, 20-item stock check matches, 20-bill totals match, 5-line bill under 60 seconds.
