# Quickstart: validating feature 007 (MVP part)

Prerequisites: 002, 003 and 005 merged. Commands as in 001. Commands and codes: `contracts/ipc-commands.md`.

Setup: locations Shop floor (R1 to R5), Godown (G1, G2), Defective; item "PVC Pipe 1 in", 30 in Godown, 10 in R3, home location R3; one more item assigned to each of R1, R2, R4 and R5, so all five racks count toward progress.

## 1. Movements by location (M2; US1)

1. Transfer 10 from Godown to Shop floor R3. Expected: Godown 20, R3 20, total 40 unchanged; one `transfer` movement with both locations.
2. Sell 3 at the counter (sale location Shop floor). Expected: R3 falls to 17.
3. Damage 2 from R3. Expected: R3 15, Defective 2, total 37 (damaged goods visible).
4. Try `UPDATE stock_movement ...` on a test copy. Expected: rejected.
5. Lookup. Expected: per location, total, last purchase price, last sale date; rolls column hidden.
6. Add "Godown 2" and rack "G2-A"; transfer into it. Expected: works.

## 2. Opening stock by rack (M3; US2)

1. Start a count on R3; scan 25 items and enter counts; time it (SC-002, under 10 minutes).
2. While counting, sell one counted item. Expected: after "Mark done" the correction uses the book quantity at the count time; the sale is not lost.
3. Expected: R3 done; progress "1 of 5 racks"; items on other racks show "Uncounted", not 0.

## 3. Adjustments and negative stock (M4; US3)

1. Counter user adjusts. Expected: refused (permission).
2. Manager adjusts -1 with reason "count error". Expected: saved. Without a reason: refused.
3. Adjust -50 (value above the threshold). Expected: owner approval needed.
4. Sell more than in stock. Expected: bill saves; negative list shows the item; selling stock back in clears it.
5. Scan a barcode on two items. Expected: chooser (002).
6. Run `stock.verify`. Expected: 0 mismatches (SC-005).

## 4. Both themes

Locations, lookup, transfer, count and adjustment screens readable in System, Light and Dark.
