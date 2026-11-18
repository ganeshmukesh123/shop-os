# Data Model: Go-Live, Data Migration and Release Practice

Builds on 002 (import, merge), 004 (party import), 005 (users), 007 (counts) and 001's backups. Conventions unchanged. Decisions in `research.md` D1 to D11.

## New tables

### `readiness_input` (one row, owner-entered)

`credit_parties_in_old_books` (count), `go_live_date`, `updated_at`.

### `signoff_item`

`code` (`tiers`, `roles`, `discount_limits`, `mrp_rules`, `paint_classes`, `shelf_tags`, `custom`), `label`, `signed_off_at` (nullable), `signed_off_by` (nullable), `note`. Seeded with the six PRD items.

### `training_record`

`user_id`, `session_no` (1 or 2), `held_on`, `test_bills_unaided` (0 to 5), `passed` (1 when 5 unaided), `is_champion` (at most one champion per shop, partial unique index), `trainer_note`.

### `daily_reconciliation` (append-only; a correction is a new row for the same date that supersedes)

`business_date`, `old_book_total_paise`, `footfall_estimate` (nullable), `system_sales_paise`, `system_cash_expected_paise`, `counted_cash_paise` (from 005's close), `difference_paise`, `note`, `entered_by`, `entered_at`.

### `gate_review` (append-only)

`gate` (`gate1`, `gate2`, `gate3`, `restore_drill`), `held_on`, `outcome` (`pass`, `fail`), `complaints_json` (up to 3: text, fix status `open` or `fixed`), `duration_minutes` (restore drills), `note`.

### `feature_switch`

`feature_code` (unique, for example `delivery`, `gst_tax_invoice`, `reports_v2`), `is_on` (default 0), `switched_on_at`, `walkthrough_on`, `walkthrough_attendees` (JSON list of user ids). Every switch change is audited (005).

### `release_marker`

`app_version`, `first_started_at`, `pre_upgrade_backup_path`, `migrations_applied_json`, `all_additive` (0 or 1).

## Changed tables

- `number_series.doc_kind` adds `paper_backfill`; such a series has no template: its `bill_no` is the paper number typed by the user (at most 16 characters, unique per shop like every bill number).
- `bill` adds `paper_bill_ref` (nullable text; set only for `paper_backfill` bills).
- Migrations journal: each migration file carries a header comment `-- additive: true` or `false`; `release_marker.all_additive` is derived (research D10).

## Training database

`training.sqlite` in the user-data folder, made from the real file by the online backup API, with `shop_profile.is_training = 1`, every `number_series` template prefixed `T-` and sync disabled. Never backed up to the cloud, deleted and remade on "Reset training data".

## Derived values (in `@shopos/core`)

- `checkReadiness(input)` returning `{ status, gaps[] }`.
- `shareBilledInSystem({ systemSalesPaise, oldBookPaise, cashSurplusPaise })` in basis points.
- `bypassSignals(days)`: bills per footfall and cash difference over 14 days.
- `top200Accuracy({ topItems, countLines, toleranceBp })`.
- `isTrainingSeries(template)`; `trainingTemplate(template)` keeps 16 characters or fewer.

Example: system sales ₹38,200, old book ₹1,500, cash surplus ₹300: share = 38,200 / 40,000 = 95.5%.
