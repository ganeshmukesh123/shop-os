# Quickstart: validating feature 012

Prerequisites: 002, 004, 005 and 007 merged (010 for server restore). Commands as in 001. Commands and codes: `contracts/ipc-commands.md`. The go-live procedure itself is in `plan.md` ("Go-live runbook").

## 1. Load data and readiness (M1; US1)

1. Import 520 items (3 without a unit, 2 duplicate groups) and 100 parties with balances (002 and 004 imports). Enter "credit parties in old books: 100".
2. Run readiness. Expected: "Not ready: 3 items have no unit; 2 duplicate groups open".
3. Fix the units; merge the duplicates (002). Run again. Expected: "Ready" when 500 or more items and all 100 parties are loaded (SC-002 date recorded).
4. Run the same imports again. Expected: nothing double-posts.

## 2. Sign-off and training (M2; US2)

1. Mark the six settings items signed off.
2. Enter training mode. Expected: orange "TRAINING" banner; bill numbers start with `TR/` (for example `TR/26-27/000124`).
3. A trainee saves 5 bills unaided; leave training mode. Expected: real stock, ledgers and bill numbers unchanged (compare counts before and after).
4. Record both sessions and the 5-bill result; name a champion. A second champion is refused.

## 3. Parallel run (M3; US3)

1. Evening: enter old-book total ₹1,500 for a day with system sales ₹38,200 and cash surplus ₹300. Expected: share 95.5% against 95%.
2. During a simulated outage write paper bill P-0451; back-fill it the same day. Expected: bill number "P-0451", stock and ledger updated, print says "Back-filled from paper bill P-0451"; no new system number used.
3. 14 days of footfall and cash differences. Expected: the bypass view shows both trends.

## 4. Accuracy and gates (M3; US4)

1. Count 20 top items in rack counts with 1 mismatch. Expected: 95% of counted, "counted 20 of 200".
2. Record Gate 1 as fail with three complaints, fix them, record pass.

## 5. Releases and rollback (M1; US5)

1. Install version N+1 with a new feature. Expected: the feature is off; switching it on asks for the walkthrough date and attendees.
2. Roll back to version N (additive migrations only). Expected: the shop's data opens; bills saved on N+1 are there.
3. A person other than the builder restores a backup on a clean machine with the guide. Expected: under 30 minutes (SC-006), recorded as a restore drill.

## 6. Both themes

Readiness, sign-off, training, reconciliation, accuracy, gates and feature-switch screens readable in System, Light and Dark; the training banner stays readable in both.
