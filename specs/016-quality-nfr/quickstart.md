# Quickstart: validating feature 016

Prerequisites: 001 and 017 merged. Commands: `contracts/quality-commands.md`.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ee7d52c29616bb0a06d9d4696b5cb96aab8c6663a54711192e79bffc090eebe2 -->

## 1. Speed budgets (M1; US1)

1. `pnpm quality:dataset --profile release --seed 42 --out /tmp/release.sqlite`. Expected: 50,000 variants, about 365,000 bills; size and time printed.
2. `pnpm quality:bench --dataset /tmp/release.sqlite` on the owner's counter computer. Expected: a run file with search, bill save, save and print, and start-up measures against `quality/budgets.json` (SC-001). Check the daily sales report measure after feature 011 lands.
3. Build the scale dataset once and run the bench. Expected: size and time recorded (OI-1); budgets checked at 10 years of data (NFR-014).
4. Make one budget deliberately fail (lower it in a branch). Expected: the run marks the miss; the release gate refuses it without an accepted note.

<!-- /coderabbit-ai-generated:v1 -->

## 2. Offline and no lost bills (M2; US2)

1. `pnpm quality:offline`. Expected: packaged app bills with the network denied; 50 kill-during-save runs leave every bill complete or absent; double-submit makes one bill (SC-002).
2. After 010: the routine includes the 7-day, 2-counter-and-phone simulation with 0 duplicates and 0 lost.
3. Open a test issue labelled `bill-integrity`. Expected: `release-gate` fails.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:886bf4c3937a1ff6ee3f92820c98120b64739dff51a2f24d8985677ee280408f -->

## 3. Backup verification (M2; US3)

1. Run a backup. Expected: `backup_log.verified_at` set after the automatic test restore.
2. On a disposable test database, run the existing `backup.run` command with a test fixture that corrupts the generated backup after the copy is written and before automatic verification starts. Confirm that the verifier sets `backup_log.verify_error`, leaves `verified_at` unset, and the health check (015) shows “Last backup could not be restored.”
3. After 010 and 012: the restore drill by someone else is recorded in `quality/drills/` (SC-003).

<!-- /coderabbit-ai-generated:v1 -->

## 4. Security (M2; US4)

`pnpm quality:security` on a database with the test PIN 4826. Expected: the PIN appears nowhere in plain text in the database or logs (SC-004); the audit shows no high or critical dependency findings, or the run fails.

## 5. Accessibility, print and rules (M2; US5)

1. `pnpm quality:a11y`. Expected: no axe violations at "serious" or "critical" on any screen in either theme; counter buttons at least 44 px.
2. `pnpm quality:print-snapshots`. Expected: layouts at 58 mm, 80 mm, A4 and A5 match the approved snapshots.
3. Change a discount limit in settings and give a discount right after. Expected: the new limit applies without a restart (NFR-016).

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:382b6136106c71d083172b3ed96d0121ab16a3f49a270ae75f61db4c75a3e594 -->

## 6. Release record

1. Run `pnpm quality:release-record 0.9.0`. Complete the applicable manual items in `quality/releases/0.9.0.md` and commit the operator-edited record with the CI result and link pending.
2. Create and push the `v0.9.0` tag on that commit so the gate checks the record in the tagged tree.
3. After the first `release-gate` run, add its result and link to the same record and commit the update on the release branch. Publish only after the gate passes for the tagged commit and the CI evidence is committed (see the [release record workflow](contracts/quality-commands.md#release-record-workflow)).

<!-- /coderabbit-ai-generated:v1 -->
