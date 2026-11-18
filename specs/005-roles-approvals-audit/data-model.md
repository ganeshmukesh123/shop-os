# Data Model: Roles, Approvals, Audit Log and Cash Day-Close

Builds on 001's target shape and 002's `exception_event`. Conventions unchanged. Decisions in `research.md` D1 to D12.

## Overview

```
app_role 1--* role_permission
app_role 1--* app_user 1--* approval_request (requested_by / decided_by)
app_user 1--* audit_log (hash chain per device)
app_user 0..1--1 discount_limit (per role or per user)
cash_session (per counter, business date) 1--* cash_entry, 1--0..1 cash_count
problem_report    device (one row for this computer)    owner_recovery (hash)
```

## Tables

### `app_role`

`code` (`owner`, `manager`, `counter`, `godown`, `accountant`), `label`; seeded; the owner cannot delete roles in this feature (custom roles later).

### `role_permission`

`role_id`, `permission` (text key, list below), `mode` (`allow`, `request`, `approve`, `deny`), `threshold_paise` (nullable, for "up to threshold"). `UNIQUE(role_id, permission)`. Editable by the owner; every change is audited.

Permission keys: `bill.create`, `quote.create`, `discount.give`, `bill.below_cost`, `bill.cancel`, `return.without_bill`, `credit.over_limit`, `payment.receive`, `stock.receive`, `stock.move`, `stock.count`, `stock.adjust`, `item.edit`, `price.edit`, `tier.edit`, `report.profit`, `data.export`, `settings.edit`, `users.manage`, `bill.edit_same_day`.

### Seeded permissions (PRD section 15)

| Permission                                        | Owner   | Manager                        | Counter    | Godown  | Accountant |
| ------------------------------------------------- | ------- | ------------------------------ | ---------- | ------- | ---------- |
| bill.create, quote.create                         | allow   | allow                          | allow      | deny    | deny       |
| discount.give (own limit)                         | allow   | allow (10%)                    | allow (3%) | deny    | deny       |
| bill.below_cost, bill.cancel, return.without_bill | approve | request (approve if delegated) | request    | deny    | deny       |
| credit.over_limit                                 | approve | request                        | request    | deny    | deny       |
| payment.receive                                   | allow   | allow                          | allow      | deny    | deny       |
| stock.receive, stock.move, stock.count            | allow   | allow                          | deny       | allow   | deny       |
| stock.adjust                                      | approve | allow up to threshold          | deny       | request | deny       |
| item.edit, price.edit, tier.edit                  | allow   | allow                          | deny       | deny    | deny       |
| report.profit                                     | allow   | deny (optional)                | deny       | deny    | allow      |
| data.export                                       | allow   | deny                           | deny       | deny    | allow      |
| settings.edit, users.manage                       | allow   | deny                           | deny       | deny    | deny       |
| bill.edit_same_day                                | allow   | allow                          | deny       | deny    | deny       |

`bill.edit_same_day` is not in the PRD table; it follows FR-BIL-017 ("roles with permission") and is seeded for Owner and Manager (owner may change).

### `app_user`

`name` (1-60), `role_id`, `pin_hash` (`scrypt$N$r$p$salt$hash`), `is_active`, `failed_pin_count`, `locked_until` (epoch ms, nullable), `discount_limit_bp` (nullable; overrides the role), `discount_limit_paise` (nullable, rupees per bill). Users are deactivated, never deleted. At least one active owner (service check).

### `owner_recovery`

`user_id` (the owner), `code_hash`, `created_at`, `used_at` (nullable). One unused row per owner.

### `device`

One row for this computer: `kind` (`desktop`), `counter_code`, `label`, `revoked_at` (nullable; set remotely in 010). The existing device id from `shop_profile` becomes this row's id.

### `approval_request`

| Field                                                                                     | Rule                                                                                                                                             |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| kind                                                                                      | `below_cost`, `over_discount`, `over_credit`, `cancel`, `return_without_bill`, `tinted_return`, `stock_adjust_over_threshold`, `edit_after_save` |
| subject_type, subject_id                                                                  | for example `draft_bill` and the `client_bill_id`; `bill` and its id for cancel                                                                  |
| amount_paise                                                                              | the exact amount allowed (price, discount, credit, bill total), nullable for cancel                                                              |
| detail_json                                                                               | what the approver sees (item, price, cost, limit)                                                                                                |
| requested_by, device_id, requested_at, expires_at                                         | expiry = requested + 120,000 ms                                                                                                                  |
| status                                                                                    | `requested`, `approved`, `rejected`, `expired`, `consumed`; trigger allows only the transitions in the state machine                             |
| decided_by, decided_at, decision_mode (`pin`, `remote`), reason (required for `rejected`) | `decided_by <> requested_by` (CHECK)                                                                                                             |
| consumed_by_type, consumed_by_id, consumed_at                                             | set once                                                                                                                                         |

### `audit_log` (append-only)

| Field                   | Rule                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| seq                     | integer, unique per **device**, increasing by 1 (`UNIQUE(device_id, seq)`); each device keeps its own chain so offline devices never collide |
| action                  | for example `item.update`, `bill.cancel`, `approval.decide`, `user.sign_in`, `pin.failed`, `settings.update`, `data.export`                  |
| entity_type, entity_id  | nullable for sign-in                                                                                                                         |
| user_id, device_id      | user nullable only for failed PINs of unknown users                                                                                          |
| device_time             | epoch ms (local clock); `server_time` nullable, filled by 010                                                                                |
| before_json, after_json | changed fields only, nullable                                                                                                                |
| reason                  | nullable text up to 200                                                                                                                      |
| prev_hash, row_hash     | 64 hex characters each; first row's `prev_hash` is 64 zeros                                                                                  |

Triggers reject UPDATE and DELETE. Verification walks each device's chain in `seq` order and recomputes each `row_hash`. With sync (010), the server verifies every device's chain as it arrives and records the order it received entries in; a single business-wide sequence is impossible while devices work offline.

### `cash_session`

`counter_code`, `business_date`, `status` (`open`, `counting`, `closed`), `opening_float_paise`, `opened_by`, `opened_at`, `expected_paise` (stored at close), `counted_paise`, `variance_paise`, `variance_reason` (required when variance is not 0), `closed_by`, `closed_at`. `UNIQUE(shop_id, counter_code, business_date)`. Updates allowed only along open, counting, closed (trigger); a closed session never changes.

### `cash_entry` (append-only)

`session_id`, `kind` (`opening_float`, `cash_sale`, `cash_sale_reverse`, `cash_receipt`, `cash_refund`, `cash_expense`, `cash_drop`, `cash_in_other`), `amount_paise` (signed: in positive, out negative; `kind` is a foreign key to a `cash_entry_kind` lookup table with a `sign` column, checked by a trigger, so 006, 009 and 011 add kinds by INSERT; 002 research D17), `doc_type`, `doc_id`, `note` (required for `cash_expense`, `cash_drop`, `cash_in_other`), `user_id`, `occurred_at`.

### `cash_count`

`session_id` unique, `denominations_json` (for example `{"50000": 30, "10000": 20, "1000": 7}`: note value in paise to count), `total_paise` (must equal the sum, checked in core).

### `problem_report`

`screen` (route name), `user_id`, `text` (up to 1,000), `photo_path` and `voice_path` (nullable, inside the data folder), `status` (`new`, `seen`, `done`), `created_at`. Status may change; text and attachments do not.

### `setting` additions (`shop_profile` or a settings table)

`idle_lock_minutes` (default 5, 1 to 60), `cash_variance_alert_paise` (default ₹200), `denominations_paise` (JSON list), `manager_delegated_kinds` (JSON list of approval kinds).

## Changed tables

Nullable `user_id` added to `bill`, `bill_line` not needed (the bill has it), `stock_movement`, `bill_tender` not needed; the item, party and settings changes are recorded in `audit_log`.

## Derived values (in `@shopos/core`)

- `checkPermission(permissions, key, { amountPaise? })` returning `allow`, `request`, `deny`.
- `effectiveDiscountLimit(role, user)`.
- `canApprove(approverPermissions, kind, requesterId, approverId)`.
- `nextApprovalStatus(current, event, nowMs)`.
- `hashAuditRow(prevHash, row)`, `verifyAuditChain(rows)`.
- `expectedCash(entries)`, `countTotal(denominations)`, `cashVariance(expected, counted)`.
- `buildDayCloseSummary(input)`.
- `isPinFormatValid(pin)` (4 to 6 digits), `lockoutUntil(failedCount, nowMs)`.

Example: expected ₹18,450.00, counted ₹18,200.00: variance -₹250.00; above the ₹200.00 alert, so an exception is raised for the owner.

## Indexes

- `app_user(role_id)`; `role_permission(role_id, permission)` unique.
- `approval_request(status, expires_at)`, `approval_request(subject_type, subject_id)`.
- `audit_log(device_id, seq)` unique, `audit_log(entity_type, entity_id)`, `audit_log(action, device_time)`.
- `cash_entry(session_id)`, `cash_session(shop_id, counter_code, business_date)` unique.
