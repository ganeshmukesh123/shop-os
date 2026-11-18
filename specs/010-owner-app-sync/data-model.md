# Data Model: Sync, Owner App and Cloud Backup

Two stores: each **device's SQLite** (001 to 009 tables plus the sync tables below) and the **server's PostgreSQL** (tenancy, log, indexes, projections). Conventions unchanged (UUID v7, `business_id`, `shop_id`, paise, thousandths). On the server, timestamps are `timestamptz` and JSON is `jsonb` (architecture 8.1 mapping). Decisions in `research.md` D1 to D13.

## Device (SQLite) additions

```
sync_outbox (one row per operation, same transaction as the facts) --push--> server
sync_state (device_seq counter, cursor, last push/pull times)
sync_inbox_applied (op_id of pulled operations already applied)
sync_conflict (master-data conflicts to show the owner)
device_credential (encrypted device token via safeStorage)
```

### `sync_outbox` (append-only, plus `sent_at`)

`op_id` (UUID v7, unique), `device_seq` (integer, gap-free, unique), `hlc` (text), `op_type`, `schema_v`, `actor_user_id`, `payload_json`, `created_at`, `sent_at` (nullable; set when the server answers `applied` or `duplicate`), `server_seq` (nullable), `status` (`pending`, `sent`, `rejected`), `reject_code`. Only `sent_at`, `server_seq`, `status` and `reject_code` may change (trigger).

### `sync_state` (one row)

`last_device_seq`, `pull_cursor` (last `server_seq` applied), `last_push_at`, `last_pull_at`, `last_server_time`, `hlc_last` (the latest clock seen), `schema_v`.

### `sync_inbox_applied`

`op_id` unique, `server_seq`, `applied_at`. Makes pull-apply idempotent.

### `sync_conflict`

`entity_type`, `entity_id`, `field`, `local_value_json`, `remote_value_json`, `local_hlc`, `remote_hlc`, `status` (`open`, `kept_local`, `took_remote`), `resolved_by`, `resolved_at`.

### `device_credential`

`device_id`, `token_encrypted` (safeStorage), `backup_key_encrypted`, `registered_at`, `revoked_at`.

## Server (PostgreSQL) tables

```
business 1--* shop 1--* device 1--* sync_log
                   1--* app_user (mirror for phone sign-in) 1--* push_subscription
sync_log --apply--> document_index, daily_snapshot, party_balance, stock_value, exception_event, approval_request
series_index, token_index (uniqueness checks)    device_cursor    sync_quarantine    snapshot_file    registration_code
```

### Tenancy and devices

- `business(id, name, plan)`, `shop(id, business_id, name, state_code, time_zone)`.
- `device(id, business_id, shop_id, kind` (`desktop`, `owner_phone`, `godown_phone`), `label, counter_code, token_hash, registered_at, last_seen_at, last_acked_device_seq, revoked_at, schema_v)`.
- `registration_code(code_hash, shop_id, kind, counter_code, expires_at, used_at, created_by)`; single use, 15-minute expiry.
- `app_user(id, business_id, role_code, name, is_active)` (no PINs or PIN hashes on the server or in any operation; each phone has its own device PIN and a per-device signing key, research D8).
- `device_key(device_id, public_key, registered_at, revoked_at)`: public half of each phone's Keystore signing key, used to verify remote approvals.
- `push_subscription(device_id, fcm_token, updated_at)`.

### Log and checks

- `sync_log(server_seq bigserial, op_id uuid unique, business_id, shop_id, device_id, device_seq, hlc, op_type, schema_v, actor_user_id, payload jsonb, device_time, received_at, status` (`applied`, `rejected`), `reject_code)`. `UNIQUE(device_id, device_seq)`. Append-only (trigger and no UPDATE or DELETE grant).
- `sync_quarantine(op_id, reason, payload, received_at)` for operations that cannot be applied (unknown references); never dropped.
- `device_cursor(device_id, cursor_server_seq, updated_at)`.
- `series_index(shop_id, series_key, last_seq, last_bill_no, last_device_id)`: bill, return, receipt and other numbers seen; a repeat raises a high-severity exception (architecture 5.4), except a bill version above 1 (003 D1), which shares its number by design and is checked against the version-1 row instead.
- `token_index(business_id, kind` (`upi_ref`, `cheque_no`), `value, op_id)`, unique per kind and value.

### Projections (rebuildable from `sync_log`)

- `daily_snapshot(shop_id, business_date, sales_paise, sales_by_mode jsonb, expected_cash_paise, pending_upi_paise, credit_given_paise, collected_paise, overdue_khata_paise, bills_count, cancels_count, updated_at)`.
- `document_index(shop_id, doc_type, doc_id, doc_no, business_date, party_id, amount_paise, status, op_id)` for drill-down.
- `party_balance(party_id, balance_paise, oldest_open_date)`; `stock_value(shop_id, variant_id, qty_milli, value_paise)`.
- `exception_event` and `approval_request` (same columns as the device tables of 002 and 005, plus `server_decided_at`).
- `counter_freshness(device_id, last_sync_at, pending_estimate)`.

### Backup and snapshots

- `snapshot_file(shop_id, built_at, through_server_seq, object_key, sha256, size_bytes)`: nightly per-shop SQLite files built by replay.
- `device_backup(device_id, uploaded_at, object_key, sha256, size_bytes)`: daily encrypted device files.

Row-level security on every tenant table: a session variable carries `business_id`; policies fail closed when it is not set (architecture 12.3).

## Shared operation types (`packages/sync-protocol`)

| Family      | op_type values in this feature                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Sales       | `bill.post`, `bill.edit`, `bill.cancel`, `return.post`, `quotation.save`, `held.none` (held bills do not sync) |
| Delivery    | `delivery.create`, `delivery.event`, `delivery.proof`, `delivery.handover`                                     |
| Stock       | `stock.movement`, `count.submit`, `location.upsert`                                                            |
| Khata       | `party.upsert`, `payment.receive`, `payment.pay`, `ledger.adjust`, `consent.record`                            |
| Purchasing  | `receipt.post`, `purchase_bill.post`, `purchase_return.post`, `debit_note.event`                               |
| Cash        | `cash.open`, `cash.entry`, `cash.close`                                                                        |
| Control     | `approval.request`, `approval.decide`, `audit.entries`, `user.upsert`, `role.permission`                       |
| Master data | `item.upsert`, `price.set`, `tint.formula.save`, `category.upsert`, `setting.set`                              |
| Compliance  | `registration.set`, `gst_rate.add`, `data_request.update`                                                      |

Each has a Zod payload schema with `schema_v`; the server accepts the current and the previous version (architecture 5.6).

## Derived values (in `@shopos/core`)

- `hlcNow(last, wallMs)`, `hlcReceive(last, remote, wallMs)`, `compareHlc(left, right)`.
- `nextDeviceSeq(last)`; `isSkewTooLarge(deviceMs, serverMs, limitMs)`.
- `mergeMasterField(local, remote)` returning keep, take or conflict (money fields).
- `buildDailySnapshot(operations)`; `rankAlerts(alerts)` by money at stake.
- `encryptBackup` and `decryptBackup` are in the desktop main process (Node `crypto`), not core.
