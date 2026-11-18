# Contract: server HTTP API (v1)

REST over HTTPS, JSON, gzip, under `/v1` (architecture 9.1). Errors are RFC 7807 `application/problem+json` with a stable `code`. Every write carries `Idempotency-Key`. Times are ISO 8601 UTC on the wire; devices also send their HLC. Pagination uses opaque cursors.

## Registration and auth

| Method and path                                   | Body                             | Result                                                                     | Codes                                       |
| ------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| `POST /v1/registration-codes` (owner device only) | `{ kind, counterCode? }`         | `{ code, expiresAt }`                                                      | `FORBIDDEN`                                 |
| `POST /v1/devices/register`                       | `{ code, kind, label, schemaV }` | `{ deviceId, deviceToken, counterCode?, seriesLastNumbers[] }`             | `CODE_INVALID`, `CODE_USED`, `CODE_EXPIRED` |
| `POST /v1/auth/token`                             | `{ deviceToken }`                | `{ jwt, expiresIn: 900 }`                                                  | `DEVICE_REVOKED` (403)                      |
| `POST /v1/devices/{id}/revoke` (owner)            | `{ reason }`                     | `{ revokedAt, atRisk: { lastAckedDeviceSeq, lastSyncAt, lastNumbers[] } }` |                                             |
| `GET /v1/devices` (owner)                         |                                  | `{ devices[{ id, kind, label, lastSeenAt, lastSyncAt, revokedAt }] }`      |                                             |

## Sync

| Method and path                       | Body                                                                | Result                                                                                                                                                     | Codes                                                                               |
| ------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `POST /v1/sync/push`                  | `{ deviceId, schemaV, ops[] }` (at most 200, in `device_seq` order) | `{ results[{ opId, status: "applied" or "duplicate" or "rejected" or "conflict" or "resend_from", serverSeq?, code? }], ackThroughDeviceSeq, serverTime }` | 400 `VALIDATION`, 413 `BATCH_TOO_LARGE`, 426 `SCHEMA_TOO_OLD`, 403 `DEVICE_REVOKED` |
| `GET /v1/sync/pull?cursor=&limit=500` |                                                                     | `{ ops[{ serverSeq, opId, deviceId, opType, schemaV, hlc, payload }], nextCursor, hasMore, serverTime }` (excludes the caller's own)                       | 409 `CURSOR_EXPIRED` (take a snapshot)                                              |
| `GET /v1/sync/snapshot`               |                                                                     | `{ url, sha256, throughServerSeq, sizeBytes }` (short-lived download link)                                                                                 | 404 `NO_SNAPSHOT_YET`                                                               |
| `POST /v1/backups/presign`            | `{ sizeBytes, sha256 }`                                             | `{ uploadUrl, objectKey }`                                                                                                                                 |                                                                                     |
| `POST /v1/backups/complete`           | `{ objectKey, sha256 }`                                             | `{ recorded }`                                                                                                                                             | `CHECKSUM_MISMATCH`                                                                 |

Push rules: each operation in its own savepoint; known `op_id` gives `duplicate`; a `device_seq` that is not the next expected gives `resend_from` with the expected number (nothing after it is applied); a bill number or UPI reference already used gives `rejected` with the code and the operation is kept and flagged (architecture 9.3, 9.5).

## Owner queries

| Method and path                                                       | Result                                                                                                                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /v1/owner/today?shop=&date=`                                     | `{ figures{ sales, expectedCash, pendingUpi, creditGiven, collected, overdueKhata }, sameDayLastWeek{...}, updatedAt, counters[{ label, lastSyncAt, isBehind }] }` |
| `GET /v1/owner/drill?shop=&date=&figure=`                             | `{ documents[{ docType, docId, docNo, amountPaise, party, status }] }`                                                                                             |
| `GET /v1/owner/documents/{docType}/{docId}`                           | `{ document }` (rendered from the operation payload)                                                                                                               |
| `GET /v1/owner/alerts?shop=`                                          | `{ alerts[{ kind, moneyAtStakePaise, title, link }] }` ranked                                                                                                      |
| `GET /v1/owner/exceptions?status=`                                    | `{ exceptions[] }`                                                                                                                                                 |
| `GET /v1/owner/conflicts` and `POST /v1/owner/conflicts/{id}/resolve` | master-data conflicts and their resolution                                                                                                                         |

## Approvals

| Method and path                                               | Body                                         | Result                                           | Codes                                                                        |
| ------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `POST /v1/approvals` (counter)                                | `{ approval }` (as 005's `approval_request`) | `{ approvalId, status: "requested", expiresAt }` |                                                                              |
| `GET /v1/approvals/{id}?wait=30` (counter, long poll)         |                                              | `{ status, decidedBy?, reason? }`                |                                                                              |
| `POST /v1/approvals/{id}/decide` (owner or delegated manager) | `{ decision, reason?, userId, signature }`   | `{ approval }`                                   | `ALREADY_DECIDED` (first decision wins), `EXPIRED`, `NOT_ALLOWED_TO_APPROVE` |
| `POST /v1/push/subscribe`                                     | `{ fcmToken }`                               | `{}`                                             |                                                                              |

`signature` is made on the phone with its per-device Keystore key (unlocked by the phone's own PIN) over the approval id, decision and amount; the server verifies it with the registered `device_key`. No PIN or PIN-derived secret reaches the server (research D8).

## Health

`GET /healthz` (process up), `GET /readyz` (database reachable, migrations current).
