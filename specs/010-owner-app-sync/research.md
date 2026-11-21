# Research: Owner and Godown Phone Apps, Sync and Cloud Backup

**Feature**: `specs/010-owner-app-sync/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD section 10 Owner app (FR-OWN-001 to 005), NFR-001 to NFR-016, EC-01 to EC-03, EC-20, the architecture reference sections 3 (options and technology), 4 (containers, server components, deployment, flows), 5 (sync design), 9 (API), 10.6, 12.1 to 12.6, the constitution v2.1.0 (principle IV, Technical Constraints "Stack": "A later server uses Node.js and PostgreSQL as set out in the architecture reference"), and the plans of 002 to 009 (every writing use case they add) and 018 (safeStorage and signing wait for this feature).

**Build window**: 8 November 2027 to 16 January 2028 (002 research D16), the longest feature. This feature **adds a server and phone apps**, so several decisions below are stack and package additions that the owner must approve (CLAUDE.md rule 6) and one touches the constitution.

## Decisions

### D1. Follow the architecture's option B: device-owned databases plus a sync hub

Each counter keeps its complete SQLite database and bills without the network (constitution IV). The server receives immutable operations, gives them a global order, serves them to other devices, keeps projections for the owner's phone and holds the cloud copy. This is architecture section 3's recommendation; no alternative is reopened here.

### D2. Server stores the operation log and projections, not a full relational mirror (for now)

- **Decision**: the server keeps (a) tenancy, users, devices and tokens; (b) `sync_log`, the append-only log of every operation with its JSON payload; (c) small index tables for the checks the server must enforce (bill numbers per series, UPI references, cheque numbers); (d) projections the owner app reads (`daily_snapshot`, `party_balance`, `stock_value`, `document_index` for drill-down, `exception_event`, `approval_request`); (e) a nightly **per-shop SQLite snapshot** built by replaying the log through the same apply handlers the desktop uses.
- **Deviation**: architecture section 8 describes the full 113-table PostgreSQL schema on the server. Building and keeping two full schemas in step (Drizzle `sqlite-core` and `pg-core`) is the largest single cost in the architecture, and none of this spec's requirements needs it: the owner's figures come from projections, drill-down from the document index plus the operation payload, and restore from the snapshot. Reports across shops (011, 013) are where a relational mirror pays; it can be built later from the same log without changing devices.
- **Trade-off table**:

| Option                                     | Cost now                                                         | Benefit                                                          | Chosen               |
| ------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------- |
| Full PostgreSQL mirror (architecture 8)    | Two schemas, two sets of migrations, server handlers per table   | SQL reports over everything                                      | No, later (011, 013) |
| Log, indexes, projections, SQLite snapshot | One schema of about 15 server tables; replay reuses desktop code | Meets FR-001 to FR-013                                           | **Yes**              |
| Log only, no projections                   | Smallest                                                         | Today card would replay the log on each open (fails 3 s, SC-002) | No                   |

- **Owner decision OD-1**: accept this deviation; the architecture gets a dated note.

### D3. Operation envelope, outbox and ordering exactly as the architecture

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:e777ee35920277a632483cfab2cf320b235f9aec354c439bda0bd23c2b44f2e4 -->

- Envelope fields `op_id` (UUID v7), `device_id`, `device_seq` (gap-free per device), `hlc`, `op_type`, `schema_v`, `business_id`, `shop_id`, `actor_user_id`, `payload` (architecture 5.1). The hybrid logical clock is a pure module in `@shopos/core` (`hlc.ts`).
- **Outbox**: every writing use case writes one `sync_outbox` row in its own SQLite transaction through an `OutboxPort` (architecture 5.2 step 1). The payload is the full set of facts (a bill carries its lines, tenders, movements, ledger and cash entries, approvals consumed and audit rows). Operation types and their payload schemas live in a new shared package `packages/sync-protocol` (Zod), used by the desktop, the server and the phone apps.
- **Retrofit**: every use case added by 001 to 009 must emit its operation. One task per use-case family (bills, returns, quotes, stock, counts, khata, purchasing, cash, approvals, audit, master data, settings); each has a test that the operation is in the same transaction.

- **Initial import (T028a)**: before enabling live outbox writes, take a consistent cut of the existing shop data. Emit every pre-010 syncable record exactly once: settings, users (no PIN material) and masters first, then documents in dependency order, then dependent lines, movements, ledger, cash, approvals and audit rows. Bundle children already carried by a document in its payload; preserve source IDs and audit-chain order. Break dependency ties by table and primary key. Persist each source identity, its assigned operation ID and outbox entry atomically; retries reuse the mapping. Publish the first shop snapshot only after all source counters’ imports are acknowledged and included in its certified prefix.

<!-- /coderabbit-ai-generated:v1 -->

### D4. Push and pull as the architecture, with the server never undoing a sale

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:7b682ef980ef53a31356abe6e3804284ed42d88585f476133dea66846430ae53 -->

Push in `device_seq` order, up to 200 per request, each in a savepoint; results `applied`, `duplicate`, `rejected` (kept as a legal record, flagged), `conflict` (master data). Pull by cursor in `server_seq` order, excluding the device's own, applied in one SQLite transaction with the cursor (architecture 5.2, 9.3). Push before pull on reconnect. Backoff with jitter capped at one minute (NFR-004: sync within a minute). To certify a safe global watermark, every log writer holds the same shared transaction advisory lock from before sequence allocation until transaction end (sequence CACHE 1, no preallocation). A periodic publisher takes the exclusive lock, then in a fresh READ COMMITTED statement records the global highest committed sequence (initially zero) and commits. Earlier allocations have now committed or rolled back; future allocations are higher. Snapshots replay only through this certified prefix. The server re-runs `@shopos/core` on bills and records `totals_verified`; a mismatch is an exception, never a rejection (architecture 9.5).

<!-- /coderabbit-ai-generated:v1 -->

### D5. Conflict rules

As architecture 5.3: facts (bills, movements, ledger, cash, audit, deliveries) never conflict; balances are recomputed; master data is field-level last-writer-wins by HLC with money fields (price, cost, MRP, credit limit, tier) raising a `sync_conflict` for the owner; settings and rules are owner-authoritative; numbers are device-owned series (no conflict by construction); approvals are single-use and the first decision wins.

### D6. Pull-apply on the desktop: which operations

The desktop applies, from other devices: every fact operation (another counter's bills and movements keep local stock converging, EC-02), master-data upserts, approval decisions from the owner's phone, and the godown app's receipts, movements and counts. Apply handlers write the rows exactly as received (ids included), so a pulled bill is byte-for-byte the author's, and they go through the same writers as local use cases (`MovementService`, `LedgerService`, the projection updaters for `item_sales_stat`, `turnover_daily` and `party_balance`), in the same transaction as the rows, so every cache stays equal to its records and the nightly verifiers of 004, 007 and 008 stay quiet (staff review 2026-11-18). Bill versions above 1 (003 D1) are applied as edits; two versions with the same predecessor from different devices are both kept and flagged (`bill_version_conflict`). The handlers and repository interfaces live in a shared package, `packages/data`, which both the desktop and the server's snapshot builder use (D14).

### D7. Stack additions (each needs owner approval)

| Need                 | Recommendation                                                                                                                                          | Alternative considered     | Why                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server runtime       | Node.js 22 LTS (constitution)                                                                                                                           | none                       | Reuses `@shopos/core`                                                                                                                                                                                             |
| HTTP framework       | **Fastify**                                                                                                                                             | NestJS (architecture 3)    | NestJS adds decorators, a DI container and a module system a solo builder must learn; Fastify has schema-validated routes and is small. The architecture's module boundaries are kept as folders plus a lint rule |
| PostgreSQL access    | Drizzle ORM with the `postgres` (postgres.js) driver                                                                                                    | Kysely, node-postgres      | Same ORM as the desktop                                                                                                                                                                                           |
| Auth tokens          | `jose` (JWT)                                                                                                                                            | `jsonwebtoken`             | Maintained, no native code, Web Crypto based                                                                                                                                                                      |
| Push                 | Firebase Cloud Messaging via `firebase-admin`                                                                                                           | none (architecture 3)      | Android standard                                                                                                                                                                                                  |
| Object storage       | S3-compatible API via `@aws-sdk/client-s3`                                                                                                              | provider SDKs              | Works with most providers                                                                                                                                                                                         |
| Phone apps           | **React Native with Expo** (Android first)                                                                                                              | Flutter; bare React Native | Shares TypeScript and `@shopos/core` (architecture 3); Expo handles builds, camera and push without native setup                                                                                                  |
| Phone local database | `expo-sqlite` with Drizzle                                                                                                                              | `op-sqlite`                | Drizzle supports it; the architecture asks to confirm the driver in a spike (OI-1)                                                                                                                                |
| Hosting              | One small VM (for example a 2 vCPU VM at an Indian region) with managed or container PostgreSQL, a reverse proxy with automatic TLS, and object storage | Serverless                 | Architecture 4.4; prices not checked (OI-4)                                                                                                                                                                       |

**Constitution**: the "Stack" constraint names Electron, React, Radix UI, SQLite, Drizzle and "a later server" in Node.js and PostgreSQL. It does not name React Native or Expo for phones, so adding them is an amendment (MINOR: a new obligation for a layer). Owner decision OD-2; the amendment is proposed, not made, in this plan.

### D8. Device registration, tokens and revoke

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:884129eb9284eac5cc124e1df4c6610971aa61cf156040c31996ed8bd5a89f37 -->

- The owner creates a one-time code on the desktop (or the owner app); a new device exchanges it at `POST /v1/devices/register` for an opaque device token, stored with Electron `safeStorage` on desktops (018's US5 waits for this) and the Android Keystore on phones. The token is exchanged for a 15-minute JWT (architecture 9.1). **PINs and PIN hashes never leave the device that set them** (staff review 2026-11-18): `user.upsert` operations carry no `pin_hash`; a 6-digit PIN hash can be brute-forced offline (005 D1), so it must not pass through the server. Each phone user sets a device PIN on that phone, which unlocks a per-device signing key kept in the Android Keystore; the public half is registered with the server at enrolment. Remote approvals are signed with that key, and the server verifies the signature (no shared secret, no PIN-derived key on the server).
- **Revoke** (EC-03): the owner revokes from the desktop Devices screen in M3 (or the phone once available); the token stops working at once; the revoked device, when it next connects, receives `DEVICE_REVOKED`, locks itself and pushes nothing more. The "at risk" report shows the device's last acknowledged `device_seq`, last sync time and the last bill number the server saw from each of its series; bills made after that are unknown to the server and are listed as "possibly unsynced since <time>".
- **Clock** (EC-20): the server records `received_at` with every operation; a skew above 10 minutes between device time and server time raises an exception (the spec's 10 minutes; the architecture's 5-minute banner is kept as the warning level).

<!-- /coderabbit-ai-generated:v1 -->

### D9. "Encrypted cloud backup every 15 minutes" is the synced log plus encrypted files

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:0612baec24cf7a6e5da1892bdb7e9cb173f16758785ab27a43bfd00f56d27233 -->

- Every operation reaches the server within a minute when online (D4), and the server's PostgreSQL archives its write-ahead log to object storage every 15 minutes with a nightly base backup (architecture 4.2, 12.2). Both archives require encryption for NFR-006; the method and key owner are unverified (OI-8).
- In addition, each desktop uploads its own SQLite file daily, made with SQLite's online backup API (constitution) and encrypted on the device with AES-256-GCM (Node `crypto`) under a backup key held in `safeStorage` and printed once as a recovery key (like 005's recovery code). The daily second-drive copy from 001 stays.
- **Restore in 30 minutes** (SC-005): register the new device with a code, download the shop's latest snapshot (checksum verified), pull the log after it, and bill under a fresh counter code. For a lost device, retire its series permanently: architecture 5.4’s last-known-number handshake cannot account for unacknowledged bills. The written restore guide is updated and rehearsed by someone other than the builder.

<!-- /coderabbit-ai-generated:v1 -->

### D10. Remote approvals

The counter sends `POST /v1/approvals` (and writes the request to its outbox for the record); the server pushes an FCM notification to every signed-in owner phone (and delegated managers); the first decision wins in one server transaction; the counter waits for the decision by long-polling `GET /v1/approvals/{id}` for up to 2 minutes, then expires the request locally. With no network the counter offers only the on-device PIN (005). Target: the notification within 10 seconds when online (FR-004, SC-002), measured.

### D11. Owner app: Today card, drill-down, ranked alerts

- Today card from `daily_snapshot` (sales, expected cash, pending UPI, credit given, collected, overdue khata) with the same weekday last week and "updated x minutes ago", plus each counter's last sync time; if a counter is behind, the card says so instead of presenting partial figures as complete (architecture 9.7).
- Drill-down: `document_index` lists the documents behind a figure; tapping one fetches its operation payload and renders it (3 taps, NFR-015).
- Ranked alerts: pending approvals, cash differences, below-cost and cancelled bills, overdue parties (later: low stock, claims, licence), ordered by money at stake (`rankAlerts` in core).
- Weak signal: the app keeps its last data locally and shows its age (FR-005).

### D12. Godown app (US4, P2)

Scan-first React Native screens for receiving (009 receipts as drafts posted from the phone), finding stock (007 lookup from the local copy), moving (007 transfers) and counting racks (007 count sessions). Camera barcode scanning with `expo-camera` (015 covers scanners in depth). Operations sync to the counter like any device.

### D13. Breach response plan and availability

A written plan in `docs/operations/breach-response.md` (who decides, how affected people and the Data Protection Board are told, the 72-hour detailed report, evidence kept) for counsel to review (FR-011, NFR-009). Availability 99.5% a month (FR-010) with one VM: an external uptime check, alerting to the builder's phone, a quarterly restore drill (architecture 12.2). Counters never depend on the server (constitution IV).

### D14. Shared data package and a separate server install (staff review 2026-11-18)

- **Problem**: the snapshot builder (D2) replays operations with the desktop's apply handlers, which need better-sqlite3. The workspace keeps one native binary per install and it must be the Electron build (CLAUDE.md); plain Node on the server fails with `NODE_MODULE_VERSION`. Importing `apps/desktop` internals from `apps/server` also breaks the layering rules.
- **Decision**: move the apply handlers, the repository interfaces and their SQLite implementations into `packages/data` (no Electron imports). The server is built and deployed from its own install (a Docker image running `pnpm install --filter @shopos/server...`), which compiles better-sqlite3 for the server's Node ABI; the desktop keeps the Electron build. A CI job builds both and runs the snapshot test in the server image.
- **Alternative**: run the snapshot builder under an Electron binary with `ELECTRON_RUN_AS_NODE` on the server (works with one binary, but ships Electron to a server). Rejected unless the separate install proves hard (OI-7).

## Open items

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:d29189ab4370c1b5f8980329a8b8e74e7092f0c7ead01b180a7a67c74a465625 -->

| ID   | Item                                                                                                        | Resolve by                         | Milestone |
| ---- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------- |
| OI-1 | Phone SQLite driver with Drizzle (expo-sqlite) handles 50,000 items and the snapshot size                   | Spike on a mid-range Android phone | M1        |
| OI-2 | Snapshot size for 24 months of the shop's data (architecture estimates a few hundred MB, not measured)      | Measure on generated data          | M3        |
| OI-3 | FCM delivery time in the shop's area (10 s target)                                                          | Measure 50 notifications           | M5        |
| OI-4 | Hosting cost and region (VM, database, object storage)                                                      | Current quotes                     | M1        |
| OI-5 | Breach plan wording, notice periods and the Board's process under the DPDP Rules 2025                       | Counsel                            | M3        |
| OI-7 | Separate server install builds better-sqlite3 for Node in Docker while the desktop keeps the Electron build | Build both in CI                   | M1        |
| OI-8 | Encryption method and key custodian for WAL archives and nightly base backups | Verify deployment settings and rehearse key-authorized restore | M3 |
| OI-6 | `safeStorage` behaviour on Linux without a keyring (backup key and device token)                            | Test on Ubuntu                     | M3        |

<!-- /coderabbit-ai-generated:v1 -->

## Owner decisions needed

| ID   | Question                                                                                                                              | Recommendation          | Needed by |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------- |
| OD-1 | Server holds the log, indexes, projections and SQLite snapshots, not a full PostgreSQL mirror (D2)                                    | Yes                     | M1        |
| OD-2 | Add React Native with Expo for phones (constitution amendment to the Stack line)                                                      | Yes                     | M1        |
| OD-3 | Packages and services in D7 (Fastify, Drizzle pg, postgres.js, jose, firebase-admin, S3 client, Expo modules), and a hosting provider | Yes, with OI-4's quotes | M1        |
| OD-4 | Backup key held by the device and printed as a recovery key                                                                           | Yes                     | M3        |

## References

- Architecture reference sections 3, 4, 5, 9 and 12 (`docs/reference/architecture.md`).
- Kulkarni, Demirbas et al., "Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases" (hybrid logical clocks), 2014: https://cse.buffalo.edu/tech-reports/2014-04.pdf (primary).
- Kleppmann et al., "Local-first software: you own your data, in spite of the cloud", Onward! 2019: https://www.inkandswitch.com/local-first/ (primary).
- Microservices.io, "Transactional outbox" pattern: https://microservices.io/patterns/data/transactional-outbox.html (secondhand summary by a practitioner).
- PostgreSQL continuous archiving and point-in-time recovery: https://www.postgresql.org/docs/16/continuous-archiving.html (primary).
- Electron `safeStorage`: https://www.electronjs.org/docs/latest/api/safe-storage (primary).
- Firebase Cloud Messaging: https://firebase.google.com/docs/cloud-messaging (primary vendor documentation).
- Fastify: https://fastify.dev/docs/latest/ (primary); Expo: https://docs.expo.dev/ (primary vendor documentation).
- Industry practice: Linear's sync engine sends client transactions to a server that orders them and streams deltas back (Linear engineering talk "Scaling the Linear Sync Engine", 2023, company's own presentation; secondhand transcripts). Figma's multiplayer uses a server-ordered operation log with last-writer-wins per property (https://www.figma.com/blog/how-figmas-multiplayer-technology-works/, company engineering blog). Square POS supports offline payments that are queued and forwarded later (https://squareup.com/help/us/en/article/7777-process-card-payments-with-offline-mode, primary vendor documentation). D3 to D5 follow the same shapes.
