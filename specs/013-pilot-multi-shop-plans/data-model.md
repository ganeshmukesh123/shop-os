# Data Model: Pilot, Multi-Shop Separation and Paid Plans

Builds on 010's server schema (business, shop, device, `sync_log`, row-level security), 012 (feature switches, readiness, training) and 005 (problem reports). Conventions unchanged. Decisions in `research.md` D1 to D10.

## Scope of records (research D1)

| Kind                    | Examples                                                                                                | Scope               | Pulled by a counter       |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------- |
| Master data             | items, families, categories, brands, parties, price tiers, party prices, roles, users                   | business            | all of its business       |
| Facts                   | bills, lines, tenders, returns, movements, counts, ledger entries, payments, cash, deliveries, receipts | shop                | only its shop             |
| Settings                | registration, number series, GST rates overrides, limits, locations, counters, feature switches         | shop                | only its shop             |
| Shared plan definitions | `plan`                                                                                                  | global (non-tenant) | never through tenant pull |

`shop_id` on master-data rows records the shop that created them; reads of master data filter by `business_id` only.

## New server tables

For each of the following three shop tables, both IDs are required. A composite foreign key
from `(business_id, shop_id)` to the shop's `(business_id, id)` must reject a mismatched pair,
including when an operation or projection is written.

### `pilot_shop_status`

`business_id`, `shop_id`, `cohort` (for example `pilot-2028-03`), `recruited_via` (distributor name), `onboarding_started_at`, `first_real_bill_at`, `status` (`recruited`, `onboarding`, `live`, `paused`, `left`), `note`.

### `onboarding_step`

`business_id`, `shop_id`, `step` (`data_loaded`, `settings_signed_off`, `staff_trained`, `first_real_bill`), `completed_at` (from the shop's operations).

### `usage_week` (projection)

`business_id`, `shop_id`, `week_start`, `active_days`, `bill_count`, `sales_paise`, `share_billed_bp` (nullable), `overdue_khata_paise`, `open_problem_reports`. Aggregates only; no party or line data.

### `plan`, `subscription`, `plan_offer`

- `plan`: `code`, `name`, `limits_json` (for example `{ "devices": 3, "premiumFeatures": ["delivery", "reports_v2"] }`), `is_free_tier`.
- `subscription`: `business_id`, `plan_id`, `state` (`trial`, `active`, `lapsed`, `cancelled`), `period_start`, `period_end`, `recorded_by`.
- `plan_offer`: `business_id`, `plan_id`, `offered_on`, `decision` (`accepted`, `declined`, `later`, nullable until decided), `decided_on`, `note`.

### `entitlement_issue` (append-only)

`business_id`, `features_json`, `issued_at`, `expires_at`, `grace_until`, `jwt_id`.

### `support_access_grant`

`business_id`, `requested_by`, `reason` (1-200), `approved_by` (owner user id), `starts_at`, `ends_at` (at most 24 hours after start), `revoked_at`. Every read under a grant writes a server `audit_log` row with the grant id.

### `business_exit`

`business_id`, `shop_id` (nullable; null means whole-business exit), `export_requested_at`, `export_delivered_at`, `export_confirmed_at`, `server_deletion_done_at`, `note`.

For a single-shop exit, the `(business_id, shop_id)` pair must reference that business's shop.

## Device additions

- `entitlement_cache(jwt, features_json, expires_at, grace_until)` (one row); premium switches (012 `feature_switch`) read it; core commands never do.

## Derived values (in `@shopos/core`)

- `recordScope(tableName)` returning `business`, `shop` or `global` for `plan` (one table of truth used by pull filters and tests). Global tables are explicitly excluded from tenant pull. Any schema table missing from the registry fails the coverage test; no implicit global scope.
- `isActiveWeek(days)`, `retentionAtWeek8(usageWeeks)` against 7 of 10.
- `effectiveEntitlement({ cached, nowMs })` with grace.
- `isAlwaysFree(command)`: billing, stock, khata, backup and export commands are always allowed.

Example: shop A active 6, 5, 7, 6 days in weeks 5 to 8 counts as retained; shop B active 4 days in week 7 does not.
