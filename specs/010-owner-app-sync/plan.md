# Implementation Plan: Owner and Godown Phone Apps, Sync and Cloud Backup

**Branch**: `010-owner-app-sync` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-owner-app-sync/spec.md`, PRD section 10 Owner app and NFR-001 to NFR-016, the architecture reference sections 3, 4, 5, 9 and 12, the constitution v2.1.0, and every writing use case planned in 001 to 009.

## Summary

Add the architecture's sync hub without making the counter depend on it. Every writing use case already in the desktop also writes one immutable operation to an outbox in the same transaction. A sync agent pushes operations in device order and pulls other devices' operations by server order; both are idempotent, so drops and retries never duplicate a bill. The server (Node.js, Fastify, PostgreSQL) keeps the operation log, a few uniqueness indexes, projections for the owner's phone and nightly per-shop SQLite snapshots built by replaying the log with the desktop's own apply handlers. On top: device registration and revoke, restore of a lost computer in 30 minutes, a daily encrypted device backup plus 15-minute server archiving, an Android owner app (Today card, drill-down, ranked alerts, remote approvals by push) and a scan-first godown app.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) everywhere; Node.js 22 LTS on the server; Electron 43's Node on the desktop; React Native (Expo) on Android.

**Primary Dependencies**: Existing desktop stack, plus (each needs owner approval, research D7 and OD-2, OD-3): Fastify, Drizzle ORM with postgres.js, jose, firebase-admin, an S3-compatible client, React Native with Expo (expo-sqlite, expo-camera, expo-notifications). A new shared package `packages/sync-protocol` holds operation schemas.

**Storage**: Devices: SQLite (new `sync_outbox`, `sync_state`, `sync_inbox_applied`, `sync_conflict`, `device_credential`). Server: PostgreSQL 16 with row-level security (tenancy, devices, `sync_log`, indexes, projections, snapshots); object storage for snapshots, device backups and the write-ahead-log archive.

**Testing**: Vitest test-first for HLC, envelope, merge rules, snapshot building and every outbox emitter; server integration tests against a real PostgreSQL in Docker; a deterministic multi-device simulation (two counters and a phone, seeded randomness, dropped connections, 7 simulated days); Playwright for the desktop indicator and restore; Maestro or Detox for the phone apps is decided in M4 (OI).

**Target Platform**: Desktop as before; server on one Linux VM; Android 10 or later for phones.

**Project Type**: desktop-app + web-service + mobile-app (pnpm workspace: `packages/core`, `packages/sync-protocol`, `apps/desktop`, `apps/server`, `apps/mobile`).

**Performance Goals**: Sync within a minute of reconnecting (NFR-004); push of 200 operations under 2 s on the server; Today card under 3 s on a phone connection (NFR-003, SC-002); approval notification under 10 s (FR-004); restore under 30 minutes (SC-005); bill save still about 1 s with the outbox row.

**Constraints**: Counters never depend on the server (constitution IV, FR-010); no fact operation is ever lost, dropped or rewritten (rejected ones are kept and flagged); PINs never leave devices; tenant isolation fails closed.

**Scale/Scope**: One shop now (up to 5 counters, 2 phones); 500 bills a day; 10 years of data (NFR-014); the server design is sized for the pilot's 10 shops (013) without change.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle              | How this plan satisfies it                                                                                                                            | Status                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| I. Saved bill versions | Operations carry facts; pulled bills are written byte for byte; the server never edits or rejects a sale, only flags it                               | Pass                                                  |
| II. Immutable records  | `sync_log` append-only; outbox rows change only their send status; projections rebuildable from the log                                               | Pass                                                  |
| III. Integers          | Payloads carry paise and thousandths as integers                                                                                                      | Pass                                                  |
| IV. Offline-first      | Billing never waits for the server; queue grows offline; remote approval is optional; 7-day offline simulation                                        | Pass                                                  |
| V. UI-free core        | HLC, merge rules, snapshot figures, alert ranking in `@shopos/core`; the server and phones reuse it                                                   | Pass                                                  |
| VI. Test-first         | Protocol and emitters tested first; simulation test is the gate for M2                                                                                | Pass                                                  |
| VII. Simplicity        | No full PostgreSQL mirror (OD-1), no broker, no cache, one VM; Fastify over NestJS (research D7)                                                      | Pass, with additions justified in Complexity Tracking |
| Stack (constraints)    | Server in Node.js and PostgreSQL as the constitution says; **React Native with Expo for phones is not in the Stack line**                             | **Needs amendment (OD-2)** before M4                  |
| Electron security      | Device token and backup key in `safeStorage` (018 US5); external calls only to the shop's server origin, added to 018's navigation and CSP allow-list | Pass                                                  |
| Privacy and records    | Data encrypted in transit (TLS) and in backups; breach plan written (FR-011); PINs never synced                                                       | Pass; OI-5 for counsel                                |

Post-design re-check (2026-11-18): the only violation is the missing phone stack in the constitution, to be amended by the owner (OD-2). The server-side deviation from architecture section 8 is recorded in research D2 for the owner (OD-1).

## Project Structure

### Documentation (this feature)

```text
specs/010-owner-app-sync/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
└── contracts/sync-api.md, contracts/ipc-commands.md
```

### Source Code (repository root)

```text
packages/core/src/sync/          # hlc.ts, deviceSeq.ts, mergeMasterField.ts, clockSkew.ts
packages/core/src/owner/         # dailySnapshot.ts, rankAlerts.ts
packages/sync-protocol/src/      # envelope.ts, opTypes/ (one file per family with Zod payloads), versions.ts
apps/desktop/src/main/
├── sync/                        # OutboxPort adapter, SyncAgent (push, pull, backoff), applyHandlers/ (one per family),
│                                # DeviceRegistration, CloudBackup (encrypt, upload), ServerRestore
├── services/**                  # every writing use case calls OutboxPort (retrofit, one PR per family)
apps/desktop/src/renderer/features/sync/
├── SyncIndicator/, Devices/, Conflicts/, RestoreFromServer/, RejectedOps/
apps/server/src/
├── app.ts, config.ts
├── modules/identity/            # business, shop, devices, registration codes, tokens
├── modules/sync/                # push, pull, savepoint apply, quarantine, cursors
├── modules/projections/         # daily snapshot, document index, balances, freshness
├── modules/approvals/           # remote approvals, FCM push
├── modules/backup/              # presign, snapshot builder (replay into SQLite with the desktop apply handlers)
├── modules/owner/               # owner query routes
└── db/                          # Drizzle pg schema, migrations, RLS policies
apps/mobile/                     # Expo app with two entry modes
├── src/owner/                   # TodayCard, Drill, Alerts, Approvals
├── src/godown/                  # Receive, Find, Move, Count
└── src/shared/                  # local DB, sync agent (same protocol), theme
docs/operations/                 # breach-response.md, server-runbook.md, restore guide update
```

**Structure Decision**: Three apps and two shared packages. The desktop's apply handlers are written once in a form the server's snapshot builder can import (they depend only on repository interfaces and Drizzle SQLite), so the snapshot and the counters cannot disagree.

## Milestone Plan

Window 8 November 2027 to 16 January 2028 (proposed, 002 research D16).

| #   | Dates            | Milestone                                                     | Exit criteria                                                                                                                                          |
| --- | ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1  | 8 to 21 Nov      | Protocol, outbox, server skeleton                             | OD-1 to OD-3 answered; HLC and envelope green; outbox for bills; push and pull against a local server; simulation harness runs; OI-1 and OI-4 answered |
| M2  | 22 Nov to 5 Dec  | Every use case emits; server applies; counters converge (US1) | All outbox emitters; apply handlers; quickstart 1; SC-001 in simulation                                                                                |
| M3  | 6 to 19 Dec      | Devices, revoke, backup, restore (US5)                        | Quickstart 5; restore drill by someone else under 30 minutes; OI-2, OI-5, OI-6 answered                                                                |
| M4  | 20 Dec to 2 Jan  | Owner app: Today card, drill-down, alerts (US2)               | Constitution amended (OD-2); quickstart 2; SC-002 for the card                                                                                         |
| M5  | 3 to 9 Jan       | Remote approvals with push (US3)                              | Quickstart 3; OI-3 measured                                                                                                                            |
| M6  | 10 to 16 Jan     | Godown app (US4)                                              | Quickstart 4                                                                                                                                           |
| Run | 4 weeks after M6 | Live sync at the shop                                         | SC-003 (card opened 6 of 7 days), SC-004 (no data unsynced over 24 hours)                                                                              |

**Risks and fallbacks**

- Sync bugs corrupt balances (the PRD's top risk): the simulation test gates every sync PR; nightly reconciliation of projections against the log; the counter's local data is never overwritten by the server.
- Ten weeks is not enough for both phone apps: the godown app (P2) moves to after the run; counts stay on the counter.
- Expo cannot meet a native need (printing, a scanner SDK): eject to a bare React Native project for that module only.
- Hosting outage: counters keep billing (constitution IV); the owner app shows its last data and age.

## Complexity Tracking

| Addition                                | Why it is needed                                                                     | Simpler alternative rejected because                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| A server, PostgreSQL and object storage | Owner phone, multi-counter stock, cloud copy (spec US1 to US5)                       | No server means no owner app and no restore without the second drive                       |
| `packages/sync-protocol`                | One definition of operations for three apps                                          | Copies of payload types drift between desktop, server and phones                           |
| React Native with Expo                  | Android owner and godown apps sharing TypeScript and `@shopos/core` (architecture 3) | Flutter needs a second implementation of the rules; a web app cannot scan offline reliably |
| Nightly SQLite snapshots by replay      | 30-minute restore and new-device bootstrap (architecture 5.7)                        | Pulling 10 years of log on a new device takes too long                                     |
| Packages listed in research D7          | Each solves one need named there                                                     | Writing JWT, push or S3 signing by hand adds security risk                                 |
