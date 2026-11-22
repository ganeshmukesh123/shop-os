# Data Model: Go-Live, Data Migration and Release Practice

Builds on 002 (import, merge), 004 (party import), 005 (users), 007 (counts) and 001's backups. Conventions unchanged. Decisions in `research.md` D1 to D11.

## New tables

### `readiness_input` (one row, owner-entered)

`credit_parties_in_old_books` (count), `go_live_date`, `top_500_item_keys` (the owner’s 500 distinct item import keys from the old books), `updated_at`.

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
- Migrations journal: version N introduces a stable compatibility table keyed by the applied Drizzle journal timestamp and SQL hash, with a required boolean additive flag and a required write-compatibility note (`independent` or `rebuilt_on_start`, research D10) (T013). Each migration file carries a header comment `-- additive: true` or `false`; `release_marker.all_additive` is derived (research D10).

## Training database

`training.sqlite` in the user-data folder, made from the real file by the online backup API, with `shop_profile.is_training = 1`, new practice bills routed through one `TR` row per shop and financial year (for example `TR/26-27/000123`) and sync disabled. Never backed up to the cloud, deleted and remade on "Reset training data".

On copy/reset, group source counters by shop and financial year. Create or reuse the unique `TR` row with the maximum `last_seq` of the group (including any existing `TR`); always use the canonical template below, regardless of source templates. Preserve other rows referenced by copied bills. Set the copy’s billing profile to the same code and template for every new bill, including in a new year. Allocate above the high-water mark, skipping already occupied bill numbers; refuse on six-digit exhaustion.

## Derived values (in `@shopos/core`)

- `checkReadiness(input)` returning `{ status, gaps[] }`.
- `shareBilledInSystem({ systemSalesPaise, oldBookPaise, cashSurplusPaise })` in basis points.
- `bypassSignals(days)`: bills per footfall and cash difference over 14 days.
- `top200Accuracy({ topItems, countLines, toleranceBp })`.
- `isTrainingSeries(seriesCode, template)` (true only for series code `TR` with the training template; a live series can use the same template); `trainingTemplate(template)` always returns `{series}/{fy}/{seq}` for use with series `TR`. Even a one-character live code with literal text uses this template; no live literals are carried over. Two code characters, two slashes, five year characters and six digits always give 15.

Example: system sales ₹38,200, old book ₹1,500, cash surplus ₹300: share = 38,200 / 40,000 = 95.5%.
