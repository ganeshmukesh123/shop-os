# Quickstart: validating feature 002

Run each scenario when the milestone named beside it is done (milestones in `plan.md`). Commands are the same as in 001: `pnpm dev`, `pnpm test`, `pnpm build && pnpm test:e2e`. The e2e specs use a throwaway data folder (`SHOPOS_USER_DATA`). Commands and error codes are in `contracts/ipc-commands.md`; tables in `data-model.md`.

## Prerequisites

- 001 phase 7 merged (tables in the target shape, round-off, time zone).
- A test database with the 001 sample items (the migration test also uses a copy of the owner's real database, taken by backup, never by copying the live file).

## 1. Families and variants (M2; US1)

1. Create family "PVC Pipe Supreme", kind general, axes size (0.5 in, 0.75 in, 1 in) and class (4 kg, 6 kg). Preview shows 6 combinations; untick "1 in x 4 kg"; save.
2. Try a fifth axis. Expected: refused with "A family can have at most 4 variant attributes".
3. On a new bill type "supreme", press Enter. Expected: a grid with sizes as rows and classes as columns, stock in each cell, the unticked cell absent; arrow keys and Enter add "0.75 in x 6 kg".
4. Wire variant with base metre and roll = 90 m: bill 2 rolls. Expected: stock falls by 180 m; the bill shows "2 roll". Bill 0.33 roll. Expected: `INEXACT_CONVERSION`.
5. Enter 2.5 on a pcs variant. Expected: rejected.
6. Deactivate a variant that is on a saved bill. Expected: allowed; the bill still shows it; no delete is offered.

Expected overall: 001 items appear as one-variant families with their old codes, stock and bills.

## 2. Search, duplicates, merge (M3; US2)

1. Give "Elbow 1 in" the names "bend" and "कोहनी". Search "bend", "कोहनी", "elbo" and "elbwo". Expected: found each time within about 0.2 s.
2. With two matches, sell one 3 times. Expected: it ranks first.
3. Create "Supreme PVC Pipe" with the same brand and axes as scenario 1. Expected: the existing family is shown before saving.
4. Give two variants the same barcode and scan it. Expected: a chooser opens; Data issues lists one open "duplicate barcode".
5. Merge B (stock 4) into A (stock 10). Expected: A shows 14, B's bills appear in A's history, the merge is in the log; reverse it. Expected: A 10, B 4, both active.
6. Benchmark: 50,000 generated variants, 50 searches. Expected: median under 0.2 s (OI-2).

## 3. Tinting (M4; US3)

Setup: base family "Royale" (base types White, Pastel, Deep; packs 1 L, 4 L), colorants Blue and Black in ml, shade "Sky Blue" with a formula for Pastel 4 L (Blue 12.5 ml, Black 0.75 ml), 4 L charge ₹60.00, Pastel 4 L price ₹1,450.00.

1. Bill Royale, Sky Blue, 4 L. Expected: colorant amounts shown; line ₹1,510.00; after save, stock of the Pastel 4 L can falls by 1, Blue by 12.5 ml and Black by 0.75 ml; the line is marked non-returnable.
2. Load a shade price of ₹1,550.00 for Sky Blue on Pastel 4 L and bill again. Expected: line ₹1,550.00, no charge added.
3. Pick a shade with no formula for 1 L. Expected: "No formula for this pack" and a custom-shade option; save a custom shade for customer "Sharma" with 5 ml Blue.
4. Start a bill for customer "Sharma". Expected: "Sky Blue" and the custom shade listed; one tap adds the last one.
5. Cancel the first tinted bill. Expected: base and both colorants restored exactly.
6. Twenty tinted sales (scripted). Expected: colorant and base stock equal the formula totals to the millilitre (SC-004).
7. Import a shade library file with 2 bad rows. Expected: preview lists both; nothing saved until confirmed.

## 4. Paint fields, labels, import (M5; US4)

1. Create a thinner without a petroleum class. Expected: refused with "Petroleum class is required for paint, thinner and solvent items".
2. Import a 3,000-row file with 20 error rows and 5 duplicate groups. Expected: preview in under 30 s listing all of them; confirm; 2,980 rows saved (SC-005).
3. Export barcode labels for 10 items to PDF. Expected: 10 labels on one 65-up sheet; each scans back to its item with a USB scanner.
4. Set warranty 24 months and serial tracking on a power tool. Expected: stored and shown on the item.

## 5. Both themes

Switch System, Light and Dark. Expected: the family form, grid, search, merge, tinting and import screens are readable in both; labels and bills print black on white.
