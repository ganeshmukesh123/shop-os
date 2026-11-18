# Research: Go-Live, Data Migration and Release Practice

**Feature**: `specs/012-go-live-data-migration/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD sections 1, 3 and 15 (dependencies, success metrics, risks, rollout, go-live table, release practices, fallback), BO-1, BO-2, the constitution v2.1.0 (Development Workflow "Release" and "Milestones and trial"), 001's plan (M6 shop trial, restore guide) and research D11 (import design moved here on 2026-11-15), and the plans of 002 (item import, merge), 004 (party import), 005 (users, roles, cash), 007 (rack counts) and 010 (server restore).

**Build window**: 23 August to 12 September 2027 (002 research D16), before go-live. The procedures (training, parallel run, gates) also apply, at smaller scope, to 001's March 2027 trial (spec assumption).

## Decisions

### D1. Imports are reused, not rebuilt

Item and shade import come from 002 (research D12 there, OD-1) and party and opening-balance import from 004 (D9). This feature adds the **readiness check** and the **clean-up loop** around them: after an import, the duplicate groups go to 002's merge tool, and the check re-runs. If the owner declined 002's OD-1, this feature builds the item import with 002's design (002 tasks T070 to T076 move here).

### D2. Readiness check as a pure function over counts

`checkReadiness({ itemCount, topItemsLoaded, partiesWithBalance, creditPartiesInOldBooks, itemsMissingPrice, itemsMissingUnit, openDuplicateGroups, settingsSignedOff, staffTrained })` in `@shopos/core` returns `ready` or `not_ready` with the list of gaps (US1 scenarios 3 and 4). Thresholds are the PRD's: at least 500 items, every credit party from the old books (the owner enters the count of credit parties in the old books), no item without a price or unit, no open duplicate group. Example: 512 items, 3 without a unit, 96 of 100 parties loaded: "Not ready: 3 items have no unit; 4 credit parties not loaded".

### D3. Training mode is a separate database file

- **Decision**: "Training mode" opens a separate SQLite file (`training.sqlite`) made from the real database with SQLite's online backup API (constitution), then marked as training: every number series has its counter code replaced by `TR` (`C1/26-27/000123` becomes `TR/26-27/000123`, 15 characters; a `T-` prefix would make 17 and break the 16-character limit, staff review 2026-11-18), sync is off, cloud backup is off, and a fixed orange "TRAINING" banner with the word shows on every screen. Leaving training mode closes that file and reopens the real one. The real database is never written while in training mode (US2 scenario 1).
- **Alternatives rejected**: a training flag on rows in the real database (every query must filter it; one missed filter corrupts real stock or ledgers); a practice shop with made-up items (staff learn on unfamiliar names).

### D4. Sign-off, training records and champions

`signoff_item` (tiers, roles, discount limits, MRP rules, paint classes, shelf tags printed, plus any the owner adds), each with `signed_off_at` and the signer. `training_record(user_id, session_no, held_on, test_bills_unaided, passed, is_champion)`; a staff member passes when 5 test bills in training mode were saved without help (the trainer ticks "unaided"). One champion per shop (PRD).

### D5. Evening reconciliation and the share of sales in the system

- `daily_reconciliation(business_date, old_book_total_paise, system_sales_paise, system_cash_paise, counted_cash_paise, difference_paise, note)`. The owner enters the old-book total (credit sales still written in the old book in week 1, PRD go-live table); the screen shows the difference against system sales and cash. A non-zero difference is listed as an exception with the date (spec edge case).
- **Share billed in the system** (the PRD's north star, SC-001): system sales / (system sales + old-book sales + unexplained cash surplus), per day and per week, against 95%. The unexplained cash surplus is counted cash minus expected cash when positive (money in the drawer with no bill). This is an estimate and is labelled so.
- **Bypass early warning** (FR-008): bills per day against footfall (the owner or champion enters an approximate footfall count each evening) and the cash difference trend, shown together for the last 14 days.

### D6. Paper bills are back-filled under their own paper numbers

- **Problem**: if a paper bill is re-entered as a normal bill, it gets a second invoice number for the same sale.
- **Decision**: back-fill uses a series of `doc_kind = 'paper_backfill'` whose bill number **is the paper book's number** (validated at most 16 characters, unique per shop), with the same business date (the PRD says the same day). Stock movements, ledger entries and cash entries are written as for a normal bill; the printed copy says "Back-filled from paper bill P-0451". No new invoice number is issued.
- **Open item OI-1**: whether the CA accepts this (paper book numbers mixed into the system's records) or wants paper bills reported separately.

### D7. Top-200 accuracy from rack counts

`top200Accuracy({ topItems, countLines, tolerance })`: the top 200 items by sales value over the last 90 days; for each counted in a 007 count session since go-live, a match when the difference is within tolerance (0 for whole units, 1% for length and weight, a setting). Accuracy = matches / counted, with "counted 140 of 200" beside it. Target 95% by day 60 (SC-005).

### D8. Gate reviews

`gate_review(gate, held_on, outcome` (`pass`, `fail`), `complaints_json` (top three with fix status), `note)`. Gate 1 at week 4 (PRD): new features start only after it passes; the app shows "Gate 1 not passed" on the feature-switch screen as a reminder, not a block.

### D9. Feature switches and the walkthrough

`feature_switch(feature_code, is_on, switched_on_at, walkthrough_on, walkthrough_attendees)`. Every feature merged after go-live registers a switch, off by default (FR-010); its entry points (menu items, shortcuts, commands) check `isFeatureOn` in the main process. Switching on asks for the walkthrough date and attendees (the PRD's 15-minute walkthrough). Not a remote flag service (spec assumption).

### D10. Releases every 2 weeks, with a real rollback path

- Release checklist (in `docs/operations/release-checklist.md`): CI green (017), the offline test kit passed (016), no open defect that can lose, duplicate or mis-total a bill (constitution VI), installers kept for the previous version, release notes for staff.
- **Rollback is hard because migrations move forward**: a database upgraded by version N+1 may not open in version N. Decision: (a) the app takes an online backup labelled with the version **before** running any migration (001 already copies before migrating; this labels and keeps it); (b) migrations in a release are **additive only** (new tables and nullable columns), so version N can open an N+1 database, and the app's start-up check accepts unknown newer migrations only when they are marked additive; (c) a release with a non-additive migration is flagged in the checklist and its rollback is "restore the pre-upgrade backup", with bills since the upgrade re-entered from printouts.
- **Open item OI-2**: how 001's `migrateValidated` and start-up safety check behave when the database has migrations the app does not know. Not found in the code read for this plan; must be tested before the first release after go-live.

### D11. Restore by someone other than the builder

The written restore guide (001, updated by 005 for the owner recovery code and 010 for server restore) is rehearsed by a person other than the builder on a clean machine, timed (SC-006, 30 minutes). The rehearsal date and time taken are recorded in `gate_review` as a "restore drill".

## Open items

| ID   | Item                                                   | Resolve by           | Milestone |
| ---- | ------------------------------------------------------ | -------------------- | --------- |
| OI-1 | Paper bills back-filled under their paper numbers (D6) | CA                   | M3        |
| OI-2 | Older app version opening a newer database (D10)       | Test with two builds | M1        |
| OI-3 | Staff count (PRD assumes 3 to 8) and training schedule | Owner                | M2        |
| OI-4 | Count tolerance for length and weight items            | Owner                | M3        |

## References

- SQLite online backup API: https://www.sqlite.org/backup.html (primary).
- PRD section 15 go-live table and release practices (`docs/reference/PRD.md`).
- Martin Fowler, "Feature Toggles": https://martinfowler.com/articles/feature-toggles.html (practitioner article by Pete Hodgson on Fowler's site).
- Martin Fowler, "Parallel Change" (expand and contract migrations): https://martinfowler.com/bliki/ParallelChange.html (primary author's writing).
- Industry practice: Google's SRE book recommends gradual rollouts with a fast, rehearsed rollback (https://sre.google/sre-book/release-engineering/, company's own book). Shopify and GitHub ship behind feature flags turned on per customer (GitHub: https://github.blog/engineering/infrastructure/ship-code-faster-safer-feature-flags/, company engineering blog). D9 and D10 are the single-shop version of both.
