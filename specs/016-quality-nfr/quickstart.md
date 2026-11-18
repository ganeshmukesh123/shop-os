# Quickstart: validating feature 016

Prerequisites: 001 and 017 merged. Commands: `contracts/quality-commands.md`.

## 1. Speed budgets (M1; US1)

1. `pnpm quality:dataset --profile release --seed 42 --out /tmp/release.sqlite`. Expected: 50,000 variants, about 365,000 bills; size and time printed.
2. `pnpm quality:bench --dataset /tmp/release.sqlite` on the owner's counter computer. Expected: a run file with search, bill save, save and print, report and start-up measures against `quality/budgets.json` (SC-001).
3. Build the scale dataset once and run the bench. Expected: size and time recorded (OI-1); budgets checked at 10 years of data (NFR-014).
4. Make one budget deliberately fail (lower it in a branch). Expected: the run marks the miss; the release gate refuses it without an accepted note.

## 2. Offline and no lost bills (M2; US2)

1. `pnpm quality:offline`. Expected: packaged app bills with the network denied; 50 kill-during-save runs leave every bill complete or absent; double-submit makes one bill (SC-002).
2. After 010: the routine includes the 7-day, 2-counter-and-phone simulation with 0 duplicates and 0 lost.
3. Open a test issue labelled `bill-integrity`. Expected: `release-gate` fails.

## 3. Backup verification (M2; US3)

1. Run a backup. Expected: `backup_log.verified_at` set after the automatic test restore.
2. Corrupt a backup file on purpose. Expected: `verify_error` set and the health check (015) shows "Last backup could not be restored".
3. After 010 and 012: the restore drill by someone else is recorded in `quality/drills/` (SC-003).

## 4. Security (M2; US4)

`pnpm quality:security` on a database with the test PIN 4826. Expected: the PIN appears nowhere in plain text in the database or logs (SC-004); the audit shows no high or critical dependency findings, or the run fails.

## 5. Accessibility, print and rules (M2; US5)

1. `pnpm quality:a11y`. Expected: no axe violations at "serious" or "critical" on any screen in either theme; counter buttons at least 44 px.
2. `pnpm quality:print-snapshots`. Expected: layouts at 58 mm, 80 mm, A4 and A5 match the approved snapshots.
3. Change a discount limit in settings and give a discount right after. Expected: the new limit applies without a restart (NFR-016).

## 6. Release record

`pnpm quality:release-record 0.9.0`, tick the manual items, tag `v0.9.0`. Expected: `release-gate` passes only when everything above passes.
