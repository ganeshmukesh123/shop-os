---
description: "Task list for feature 010: sync, server, owner app, godown app, cloud backup"
---

# Tasks: Owner and Godown Phone Apps, Sync and Cloud Backup

**Input**: Design documents from `/specs/010-owner-app-sync/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sync-api.md, contracts/ipc-commands.md, quickstart.md. Features 001 to 009 merged. Owner decisions OD-1 to OD-4 answered; constitution amended for the phone stack (OD-2) before Phase 6.

**Tests**: Included and written first (constitution VI: sync carries bills, stock and ledger; the simulation test gates every sync change).

**Organization**: Foundational protocol and server, then US1 (sync, P1), US5 (backup and devices, P1), US2 (Today card, P1), US3 (approvals, P1), US4 (godown app, P2).

## Format: `[ID] [P?] [Story] Description`

`core` = `packages/core`, `proto` = `packages/sync-protocol`, `desktop` = `apps/desktop`, `server` = `apps/server`, `mobile` = `apps/mobile`.

---

## Phase 1: Setup (M1, 8 to 14 Nov 2027)

- [ ] T001 Ask the owner OD-1 to OD-4 with OI-4's hosting quotes; record answers in `specs/010-owner-app-sync/research.md`; draft the constitution amendment for OD-2 with `/speckit-constitution` and get the owner's approval
- [ ] T002 Create `packages/sync-protocol` (`package.json` name `@shopos/sync-protocol`, Zod only, strict `tsconfig.json`, Vitest) and add it to `pnpm-workspace.yaml`
- [ ] T003 Create `apps/server` (Fastify, Drizzle pg with postgres.js, Vitest, a `docker-compose.yml` with PostgreSQL 16 for tests, scripts `dev`, `test`, `build`, `db:generate`) with its own Dockerfile and install so better-sqlite3 is built for Node there (research D14, OI-7); create `packages/data` (repositories, apply handlers, projection updaters, no Electron imports) and move the desktop repositories into it with all tests green and lint rules forbidding imports between server modules' repositories
- [ ] T004 Spike OI-1: Expo app with expo-sqlite and Drizzle loading 50,000 items on a mid-range Android phone; record timings in `specs/010-owner-app-sync/research.md`
- [ ] T005 [P] Add root scripts `test:sync-sim` and CI jobs for `apps/server` and `packages/sync-protocol` in `.github/workflows/` (spec 017's workflow)

---

## Phase 2: Foundational protocol and server (M1, 15 to 21 Nov)

- [ ] T006 [P] Write tests in `core/tests/sync/hlc.test.ts`: monotonic on one device; receive takes the max and increments; ordering across devices with skewed clocks; text form sorts like the clock
- [ ] T007 [P] Write tests in `core/tests/sync/mergeMasterField.test.ts`: later HLC wins for plain fields; money fields (price, cost, MRP, credit limit, tier) with different values give conflict; equal values never conflict
- [ ] T008 [P] Write tests in `proto/tests/envelope.test.ts`: every op type's Zod schema accepts a valid payload and rejects missing ids; schema_v current and previous accepted, older refused
- [ ] T009 Implement `core/src/sync/*.ts` and `proto/src/*.ts` to pass T006 to T008
- [ ] T010 Add `sync_outbox` (only status fields may change, trigger), `sync_state`, `sync_inbox_applied`, `sync_conflict`, `device_credential` to `desktop/src/main/db/schema.ts`; generate the migration
- [ ] T011 Write tests in `desktop/src/main/sync/OutboxPort.test.ts`: `emit` inside the caller's transaction assigns the next gap-free `device_seq` and an HLC; rollback leaves no outbox row and no gap
- [ ] T012 Implement `desktop/src/main/sync/outboxPort.ts` to pass T011, and emit `bill.post` from `SaveBill.ts` as the first emitter
- [ ] T013 Add the server schema of `data-model.md` in `server/src/db/schema.ts` (tenancy, devices, codes, `sync_log` append-only with no UPDATE or DELETE grant, quarantine, cursors, indexes, projections, snapshots, backups) with row-level security policies in a hand-written migration; test that a query without the tenant setting returns nothing
- [ ] T014 Write tests in `server/src/modules/sync/push.test.ts`: duplicate `op_id` gives `duplicate`; a gap gives `resend_from`; one bad operation in a batch is quarantined and the rest apply; a repeated bill number gives `rejected` and is kept with an exception, but a bill version above 1 with the same number is applied as an edit (003 D1) and two versions with the same predecessor from different devices are both applied and flagged; everything in one transaction per operation (savepoints)
- [ ] T015 Implement `server/src/modules/sync/` push and pull routes from `contracts/sync-api.md` to pass T014; pull excludes the caller's operations and pages by `server_seq`
- [ ] T016 Write the simulation harness `desktop/tests/sim/syncSimulation.test.ts`: in-process server, N desktop databases, seeded random schedule of bills, disconnects and reconnects, then convergence checks (every operation once per database, balances equal)

**Checkpoint (M1 exit)**: one operation type round-trips through push and pull; simulation harness runs.

---

## Phase 3: User Story 1 - Sync that never loses or duplicates a bill (M2, 22 Nov to 5 Dec; P1) MVP

- [ ] T017 [US1] Emit operations from every writing use case, one PR per family, each with a test that the operation is in the same transaction: sales (`bill.edit`, `bill.cancel`, `return.post`, `quotation.save`) in `desktop/src/main/services/billing/`, `returns/`, `quotes/`
- [ ] T018 [US1] Emit stock operations (`stock.movement`, `count.submit`, `location.upsert`) from `desktop/src/main/services/stock/`
- [ ] T019 [US1] Emit khata, purchasing, cash and delivery operations from `desktop/src/main/services/ledger/`, `payments/`, `purchasing/`, `cash/`, `delivery/`
- [ ] T020 [US1] Emit control, master-data and compliance operations (`approval.*`, `audit.entries`, `user.upsert`, `role.permission`, `item.upsert`, `price.set`, `tint.formula.save`, `category.upsert`, `setting.set`, `registration.set`, `gst_rate.add`, `consent.record`, `party.upsert`) from their services
- [ ] T021 [US1] Write tests for apply handlers in `packages/data/tests/applyHandlers/*.test.ts`: each fact operation writes the same rows with the same ids; applying twice is a no-op (`sync_inbox_applied`); master data merges by HLC and records money conflicts
- [ ] T022 [US1] Implement the apply handlers (one file per family) to pass T021 in `packages/data/src/applyHandlers/`, writing through `MovementService`, `LedgerService` and the projection updaters in the same transaction (research D6, D14), with a test that every cache equals its records after applying a pulled batch
- [ ] T023 [US1] Implement `desktop/src/main/sync/SyncAgent.ts`: push then pull, batches of 200, exponential backoff with jitter capped at 60 s, start on app start and on network change, never on the bill-save path
- [ ] T024 [US1] Implement server-side checks in `server/src/modules/sync/validators/`: totals recomputed with `@shopos/core` (`totals_verified`, mismatch exception), permission at the time from the role snapshot, approval exists and decided, bill number in the device's series and unused, UPI and cheque tokens unused, references exist (else quarantine), and each device's audit hash chain is unbroken (005: one chain per device)
- [ ] T025 [US1] Record server time with every operation and raise a skew exception above 10 minutes (EC-20) in `server/src/modules/sync/`
- [ ] T026 [P] [US1] Build `desktop/src/renderer/features/sync/SyncIndicator/` (pending count, amber when behind, "Offline" and "Removed" as words) and `RejectedOps/`
- [ ] T027 [US1] Run the simulation for 7 simulated days with 2 counters and a phone, 500 bills each, the last unit of item X sold on both, the same bill edited on both counters offline (both versions kept, one conflict), a credit party pushed over its limit by two counters (one `over_credit_after_sync` exception), random drops: assert SC-001 and EC-02 (stock -1 flagged); make it a required CI check
- [ ] T028 [US1] Write the e2e spec `desktop/tests/e2e/syncIndicator.spec.ts` for quickstart 1 steps 2 to 4

---

## Phase 4: User Story 5 - Backup, device control and recovery (M3, 6 to 19 Dec; P1)

- [ ] T029 [P] [US5] Write tests in `server/src/modules/identity/registration.test.ts`: code single-use, 15-minute expiry; register returns a token and the last numbers per series; token to 15-minute JWT; revoked token gives `DEVICE_REVOKED`
- [ ] T030 [US5] Implement registration, tokens and revoke in `server/src/modules/identity/` to pass T029; store the device token with `safeStorage` in `desktop/src/main/sync/DeviceRegistration.ts`
- [ ] T031 [P] [US5] Write tests in `desktop/src/main/sync/CloudBackup.test.ts`: the file is made with SQLite's online backup API, encrypted with AES-256-GCM under the backup key, uploaded through a presigned URL, and decrypts back to an identical database; the recovery key decrypts it on another machine
- [ ] T032 [US5] Implement `desktop/src/main/sync/CloudBackup.ts` (daily, after the second-drive copy) and `backup.showRecoveryKey` to pass T031; record OI-6 on Linux
- [ ] T033 [P] [US5] Write tests in `server/src/modules/backup/snapshotBuilder.test.ts`: replaying a shop's log through the desktop apply handlers into a new SQLite file gives the same rows as the source counter's database; checksum recorded
- [ ] T034 [US5] Implement `server/src/modules/backup/` (nightly snapshot build, presign, complete) to pass T033; configure PostgreSQL write-ahead-log archiving to object storage every 15 minutes in `docs/operations/server-runbook.md`
- [ ] T035 [US5] Implement `desktop/src/main/sync/ServerRestore.ts` (`restore.fromServer`: register, download snapshot, verify checksum, pull the rest, resume numbering from the server's last numbers) with an integration test; update the written restore guide
- [ ] T036 [P] [US5] Build `desktop/src/renderer/features/sync/Devices/` (list, create code, revoke, at-risk report) and `RestoreFromServer/`
- [ ] T037 [US5] Handle `DEVICE_REVOKED` on the desktop: lock with "This device was removed by the owner", stop pushing, keep local data
- [ ] T038 [US5] Write `docs/operations/breach-response.md` (FR-011) and send it to counsel (OI-5)
- [ ] T039 [US5] Restore drill by someone other than the builder on a clean computer; record the time (SC-005) in `specs/010-owner-app-sync/plan.md`

---

## Phase 5: User Story 2 - Owner Today card (M4, 20 Dec to 2 Jan; P1)

- [ ] T040 [P] [US2] Write tests in `core/tests/owner/dailySnapshot.test.ts`: sales, expected cash, pending UPI, credit given, collected, overdue khata from a fixed set of operations equal the desktop's day-close figures (005) for the same day
- [ ] T041 [US2] Implement `core/src/owner/dailySnapshot.ts` and `server/src/modules/projections/` (daily snapshot, document index, balances, counter freshness, updated in the push transaction; nightly rebuild compares and logs differences)
- [ ] T042 [US2] Implement owner routes `GET /v1/owner/today`, `/drill`, `/documents`, `/exceptions` in `server/src/modules/owner/` with tests that counters behind are reported, not hidden
- [ ] T043 [US2] Create `apps/mobile` (Expo, TypeScript strict, shared ESLint rules, light and dark from the phone setting) with a device PIN set on the phone (never synced) that unlocks a per-device signing key in the Android Keystore, registers the public key at enrolment, and stores the device token there; test that no `pin_hash` appears in any operation payload
- [ ] T044 [P] [US2] Build `mobile/src/owner/TodayCard/` (figures, same weekday last week, "updated x minutes ago", counters behind) and `mobile/src/owner/Drill/` (documents, open one)
- [ ] T045 [US2] Cache the last responses on the phone and show their age on weak signal (FR-005)
- [ ] T046 [US2] Measure the card on a 4G connection 20 times (SC-002, under 3 s) and record it in `specs/010-owner-app-sync/plan.md`

---

## Phase 6: User Story 3 - Ranked alerts and remote approvals (M5, 3 to 9 Jan; P1)

- [ ] T047 [P] [US3] Write tests in `core/tests/owner/rankAlerts.test.ts`: ₹45,000 overdue, ₹4,000 cancelled bill, ₹250 cash difference ranked in that order; approvals always first
- [ ] T048 [P] [US3] Write tests in `server/src/modules/approvals/approvals.test.ts`: request stored and pushed; first decision wins in one transaction; second gets `ALREADY_DECIDED`; expiry at 2 minutes; long poll returns the decision; the signature verified against the phone's registered `device_key`; a signature from a revoked device refused
- [ ] T049 [US3] Implement `core/src/owner/rankAlerts.ts` and `server/src/modules/approvals/` (FCM push with firebase-admin) to pass T047 and T048
- [ ] T050 [US3] Implement `approvals.requestRemote` in `desktop/src/main/services/approvals/` (post, long-poll up to 2 minutes, record the decision locally, fall back to the PIN prompt offline) and add "Ask owner on phone" to 005's `ApprovalPrompt`
- [ ] T051 [P] [US3] Build `mobile/src/owner/Alerts/` and `mobile/src/owner/Approvals/` (notification opens the request; approve or reject with a reason)
- [ ] T052 [US3] Measure 20 notifications (OI-3, under 10 s) and run quickstart 3

---

## Phase 7: User Story 4 - Godown phone app (M6, 10 to 16 Jan; P2)

- [ ] T053 [US4] Implement the phone's local database and sync agent in `mobile/src/shared/` using `@shopos/sync-protocol` and the same apply handlers (godown needs items, locations, stock)
- [ ] T054 [P] [US4] Build `mobile/src/godown/Count/` (rack, camera scan with expo-camera, quantity, mark done emitting `count.submit`) and `Find/`
- [ ] T055 [P] [US4] Build `mobile/src/godown/Move/` (007 transfer) and `Receive/` (009 receipt draft, posted by a role with `stock.receive`)
- [ ] T056 [US4] Run quickstart 4 with a real rack

---

## Phase 8: Polish

- [ ] T057 [P] Check the desktop sync screens in System, Light and Dark; phone apps in the phone's light and dark modes
- [ ] T058 [P] Move all new desktop text into `desktop/src/renderer/strings.ts` and phone text into `mobile/src/shared/strings.ts`
- [ ] T059 Add the server origin to 018's navigation policy and CSP `connect-src` only; test that no other origin is reachable from the renderer
- [ ] T060 Add a dated note to `docs/reference/architecture.md` section 8 for research D2 (log and projections on the server)
- [ ] T061 Set up an external uptime check and alerting; schedule the quarterly restore drill in `docs/operations/server-runbook.md`
- [ ] T062 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:sync-sim`, server tests, `pnpm build && pnpm test:e2e`
- [ ] T063 Four-week live run: record SC-003 and SC-004 in `specs/010-owner-app-sync/plan.md`

---

## Dependencies and execution order

```
Setup --> Foundational --> US1 (all emitters, apply, agent) --> US5 (devices, backup, restore)
                                         \--> US2 (owner card) --> US3 (approvals) --> US4 (godown) --> Polish
```

US2 to US4 need US1's log and US5's device registration. The constitution amendment (T001) must be approved before T043.

## Parallel examples

- Phase 2: T006, T007, T008 together.
- US1: T017, T018, T019, T020 are separate PRs that can run in parallel once T012 is merged.
- US5: T029, T031, T033 together.

## Implementation strategy

1. The protocol and the simulation test first; nothing else syncs until SC-001 holds in simulation.
2. US1 and US5 make sync and recovery real for the desktop alone; this already removes the single point of failure.
3. Then the owner app (US2, US3) and last the godown app (US4), which can slip past the window without risk to billing.
