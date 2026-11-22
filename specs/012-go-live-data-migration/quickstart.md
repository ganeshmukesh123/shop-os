# Quickstart: validating feature 012

Prerequisites: 002, 004, 005 and 007 merged (010 for server restore). Commands as in 001. Commands and codes: `contracts/ipc-commands.md`. The go-live procedure itself is in `plan.md` ("Go-live runbook").

## 1. Load data and readiness (M1; US1)

1. From the fixture’s old-book ranking select ranks 1–500 and save their distinct item import keys as the readiness reference. Import 520 items (3 without a unit, 2 duplicate groups) and 100 parties with balances (002 and 004 imports). Enter the 100 import keys of the old books' credit parties. Expected: no party gap. Then remove one party from the import and re-check: expected one party gap naming it.
2. Run readiness. Expected: "Not ready"; import gaps include 3 items without a unit and 2 open duplicate groups.
3. Fix the units; merge the duplicates (002). Run again. Compare the reference keys with loaded item keys: the set difference must be empty. Verify all 100 fixture parties and their opening balances; record the SC-002 completion date at G - 14. Import gaps are clear; sign-off and training still keep overall status "Not ready".
4. Run the same imports again. Expected: nothing double-posts.

## 2. Sign-off and training (M2; US2)

1. Mark the six settings items signed off.
2. Snapshot live stock quantities by item, ledger entries with IDs and amounts, and last_seq by shop, counter and year. Enter training mode. Expected: orange "TRAINING" banner; bill numbers start with `TR/` (for example `TR/26-27/000124`).
3. A trainee saves 5 bills unaided; leave training mode. Expected: real stock, ledgers and bill numbers unchanged (compare the same keyed values and records with the snapshot, including missing or extra keys).
4. In live mode record both sessions and the 5-bill result; name a champion. A second champion is refused. After every active staff member meets the session and bill requirements, verify overall "Ready".

## 3. Parallel run (M3; US3)

1. Evening: enter old-book total ₹1,500 for a day with system sales ₹38,200 and cash surplus ₹300. Expected: share 95.5% against 95%.
2. During a simulated outage write paper bill P-0451; back-fill it the same day. Expected: bill number "P-0451", stock and ledger updated, print says "Back-filled from paper bill P-0451"; no new system number used.
3. 14 days of footfall and cash differences. Expected: the bypass view shows both trends.

## 4. Accuracy and gates (M3; US4)

1. Count 20 top items in rack counts with 1 mismatch. Expected: 95% of counted, "counted 20 of 200".
2. Record Gate 1 as fail with three complaints, fix them, record pass.

## 5. Releases and rollback (M1; US5)

1. Install version N+1 with a new feature. Expected: the feature is off; switching it on asks for the walkthrough date and attendees.
2. Save a bill on N+1 and record its ID, bill number and total. Roll back to version N (additive migrations only). Expected: open that same database and retrieve the bill by ID; its number and total match.
3. A person other than the builder restores a backup on a clean machine with the guide. Expected: under 30 minutes (SC-006), recorded as a restore drill.

## 6. Both themes

Readiness, sign-off, training, reconciliation, accuracy, gates and feature-switch screens readable in System, Light and Dark; the training banner stays readable in both.
