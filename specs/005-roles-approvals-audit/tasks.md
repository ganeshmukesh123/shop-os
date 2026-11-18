---
description: "Task list for feature 005: roles, approvals, audit log, cash day-close, problem reports"
---

# Tasks: Roles, Approvals, Audit Log and Cash Day-Close

**Input**: Design documents from `/specs/005-roles-approvals-audit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, quickstart.md. Feature 002 merged; feature 018's permission policy merged.

**Tests**: Included and written first (constitution VI: approvals gate bill writes; cash entries are written in bill transactions).

**Organization**: US1 to US4 (P1), US5 (P2). Remote approval, remote device revoke and server time (spec US3 scenario 3, EC-03) need feature 010 and are **not planned** here beyond the fields they will use.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel-safe; **[Story]**: US1 to US5. `core` = `packages/core`, `desktop` = `apps/desktop`.

---

## Phase 1: Setup

- [ ] T001 Ask the owner OD-1 (recovery code) and OD-2 (delegated kinds) and record them in `specs/005-roles-approvals-audit/research.md`
- [ ] T002 Check OI-1: print `process.versions.node` and whether `crypto.argon2` exists in the packaged app; record the result in `specs/005-roles-approvals-audit/research.md` under D1
- [ ] T003 [P] Create `core/src/control/` with an `index.ts` barrel exported from `core/src/index.ts`

---

## Phase 2: Foundational (M1, 22 to 28 Feb 2027)

### Core rules, tests first

- [ ] T004 [P] Write tests in `core/tests/control/permissions.test.ts`: every cell of the seeded table in `data-model.md` gives the listed mode; "up to threshold" allows at or below `threshold_paise` and requests above; unknown key denies
- [ ] T005 [P] Write tests in `core/tests/control/approvalStateMachine.test.ts`: requested to approved, rejected or expired; approved to consumed or expired; every other transition refused; expiry at requested + 120,000 ms; self-approval refused; approver needs `approve` for the kind
- [ ] T006 [P] Write tests in `core/tests/control/auditChain.test.ts`: canonical JSON with sorted keys; `row_hash` = SHA-256(prev_hash + canonical row); first `prev_hash` is 64 zeros; chains are per device (two devices' rows with the same `seq` are both valid); changing any field of any row is found at that device and `seq`; a removed row is found
- [ ] T007 [P] Write tests in `core/tests/control/expectedCash.test.ts` and `denominations.test.ts`: ₹2,000 + ₹19,200 + ₹1,500 - ₹250 - ₹1,000 - ₹3,000 = ₹18,450; variance -₹250; denomination counts in paise sum exactly; a count total that differs gives `COUNT_MISMATCH`
- [ ] T008 [P] Write tests in `core/tests/control/discountLimit.test.ts` and `pinRules.test.ts`: user limit overrides role limit in percent and rupees per bill; PIN 4 to 6 digits only; lockout 30 s after 5 failures, doubling, at most 15 minutes
- [ ] T009 [P] Write tests in `core/tests/control/dayCloseSummary.test.ts`: sales by mode, pending UPI, credit given, collections, returns, cancels, approvals, cash difference from a fixed day of documents; each figure lists its document ids; missing features show "not in use"
- [ ] T010 Implement `core/src/control/*.ts` to pass T004 to T009

### Schema

- [ ] T011 Add `app_role` (5 seeded), `role_permission` (seeded from the `data-model.md` table; `UNIQUE(role_id, permission)`), `app_user` (name 1-60; `pin_hash`; discount limits; lock fields), `owner_recovery`, `device` (id = the existing device id) to `desktop/src/main/db/schema.ts` and generate the migration
- [ ] T012 Add `approval_request` (kinds and statuses of `data-model.md`; trigger allowing only the state-machine transitions; CHECK `decided_by <> requested_by`; reason required for `rejected`), `audit_log` (append-only triggers; `UNIQUE(device_id, seq)`, one chain per device), `cash_session` (status trigger; reason required when variance is not 0; `UNIQUE(shop_id, counter_code, business_date)`), `cash_entry_kind` lookup (`code`, `sign`, `requires_note`) and `cash_entry` (append-only; kind a foreign key, sign and note checked by a trigger reading the lookup; note required for `cash_expense`, `cash_drop`, `cash_in_other`), `cash_count`, `problem_report`, and the settings `idle_lock_minutes` (1 to 60, default 5), `cash_variance_alert_paise` (default 20000), `denominations_paise`, `manager_delegated_kinds`
- [ ] T013 Add nullable `user_id` to `bill` and `stock_movement` with `ALTER TABLE ADD COLUMN`
- [ ] T014 Write `desktop/tests/integration/migrations005.test.ts`: migrations on a 001 plus 002 database; nothing existing changes; append-only triggers reject UPDATE and DELETE on `audit_log` and `cash_entry`; the approval trigger rejects `consumed` to `approved`

### Session and guard

- [ ] T015 Write tests in `desktop/src/main/session/SessionManager.test.ts`: sign-in with the right PIN; wrong PIN counts and locks; idle lock after the setting; `touch` extends it; switch keeps no renderer state in the main process; sign-out clears the session
- [ ] T016 Implement `desktop/src/main/session/pinHasher.ts` (scrypt N 2^17, r 8, p 1, 16-byte salt, format `scrypt$N$r$p$salt$hash`, constant-time compare) and `SessionManager.ts` to pass T015; time sign-in on the owner's Mac (under 300 ms)
- [ ] T017 Write tests in `desktop/tests/integration/ipcGuard.test.ts`: a list of every registered command with its permission key; a command without a declared key fails the test; Counter calling `data.export` gets `PERMISSION_DENIED`; a locked session gets `SESSION_LOCKED`
- [ ] T018 Implement `desktop/src/main/ipc/guard.ts` and wrap every handler in `desktop/src/main/ipc/handlers.ts` to pass T017, with all earlier tests green (its own PR)

### Audit writer

- [ ] T019 Write tests in `desktop/src/main/services/audit/AuditService.test.ts`: `record` inside the caller's transaction (rolled back with it); `seq` increases by 1 per device under concurrent writes from one process; `verify` finds a tampered row; a device time more than 10 minutes earlier than the last entry raises a clock `exception_event`
- [ ] T020 Implement `desktop/src/main/repositories/AuditRepository.ts`, `desktop/src/main/services/audit/AuditService.ts` and the `AuditPort` adapter to pass T019; run `verify` in the background at start in `desktop/src/main/app/startApp.ts`

**Checkpoint (M1 exit)**: core green; guard on every command; audit writer in place.

---

## Phase 3: User Story 1 - PIN login and roles (M2, 1 to 7 Mar; P1) MVP

**Independent Test**: quickstart 1.

- [ ] T021 [P] [US1] Write tests in `desktop/src/main/services/users/UserService.test.ts`: `setupOwner` only when no user exists and returns a recovery code once (only its hash stored); recovery with the right code sets a new PIN and a new code; wrong code locks like a PIN; `LAST_OWNER`; permission edits audited with before and after
- [ ] T022 [US1] Implement `desktop/src/main/repositories/UserRepository.ts`, `RoleRepository.ts` and `desktop/src/main/services/users/UserService.ts` to pass T021; register `session.*`, `users.*`, `roles.*`
- [ ] T023 [US1] Record sign-in, sign-out, failed PIN, lockout, switch and recovery in the audit log through `AuditPort`
- [ ] T024 [P] [US1] Build `desktop/src/renderer/features/control/OwnerSetup/` (shown before any screen when no user exists; recovery code with Print and "I have written it down")
- [ ] T025 [P] [US1] Build `desktop/src/renderer/features/control/SignIn/` (user tiles, PIN pad with large keys, attempts left) and `LockOverlay/` (over the current screen; quick switch)
- [ ] T026 [P] [US1] Build `desktop/src/renderer/features/control/Users/` and `Roles/` (permission grid matching the PRD table, modes as words)
- [ ] T027 [US1] Add the throttled `session.touch` on input events in the app shell and hide actions the role cannot use (the main-process guard still decides)
- [ ] T028 [US1] Write the e2e spec `desktop/tests/e2e/signInRoles.spec.ts` for quickstart 1 (including the `sqlite3` CLI check that no PIN is readable)

---

## Phase 4: User Story 2 - Approvals for risky actions (M3, 8 to 11 Mar; P1)

**Independent Test**: quickstart 2.

- [ ] T029 [P] [US2] Write tests in `desktop/src/main/services/approvals/ApprovalService.test.ts`: request, approve by owner PIN, reject with reason, expire at 2 minutes; manager approves only delegated kinds; `SELF_APPROVAL`; a second decision is ignored and logged; `consume` fails for another subject, another amount, twice, or after expiry
- [ ] T030 [P] [US2] Write tests in `desktop/tests/integration/approvalOnBill.test.ts`: 002's bill save (via 001's screen) with a below-cost line needs an approval and consumes it in the bill transaction; a failed bill save leaves the approval unconsumed
- [ ] T031 [US2] Implement `desktop/src/main/repositories/ApprovalRepository.ts`, `desktop/src/main/services/approvals/ApprovalService.ts` and the `ApprovalPort` adapter to pass T029 and T030; register `approvals.*`
- [ ] T032 [US2] Apply discount limits (role and user, percent and rupees per bill) to the existing bill save path in `desktop/src/main/services/BillingService.ts`, returning `APPROVAL_REQUIRED` with kind `over_discount`; wire the stock-adjust threshold (`stock.adjust` mode and threshold) into `desktop/src/main/services/InventoryService.ts`
- [ ] T033 [US2] Require a `cancel` approval in the existing cancel path and record the cancel in the audit log
- [ ] T034 [P] [US2] Build `desktop/src/renderer/features/control/ApprovalPrompt/` (what is asked, by whom, amount; approver picker and PIN; 2-minute countdown; reject reason) and reuse it from billing, cancel and stock adjust
- [ ] T035 [US2] Write the e2e spec `desktop/tests/e2e/approvals.spec.ts` for quickstart 2

---

## Phase 5: User Story 3 - Immutable audit log (M3, 12 to 14 Mar; P1)

**Independent Test**: quickstart 3.

- [ ] T036 [P] [US3] Write tests in `desktop/tests/integration/auditCoverage.test.ts`: item create and update, price change, party and settings changes, bill save and cancel, approvals, exports, backups and restores each write one entry with the changed fields only in `before_json` and `after_json`
- [ ] T037 [US3] Call `AuditPort.record` from every existing writing service (`InventoryService`, `BillingService`, `SettingsService`, `BackupService`, and 002's services) to pass T036
- [ ] T038 [US3] Implement `audit.list`, `audit.verify` and `audit.export` (requires `data.export`; the export itself is audited)
- [ ] T039 [P] [US3] Build `desktop/src/renderer/features/control/AuditViewer/` (filters by date, user, action, item; before and after side by side; "Chain verified" or "Chain broken at entry 1234")
- [ ] T040 [US3] Write `desktop/tests/e2e/auditTamper.spec.ts` for quickstart 3 steps 2 to 4 (tamper attempts with the `sqlite3` CLI on a test copy; SC-002)

---

## Phase 6: User Story 4 - Cash drawer and day-close (M4, 15 to 19 Mar; P1)

**Independent Test**: quickstart 4.

- [ ] T041 [P] [US4] Write tests in `desktop/src/main/services/cash/CashService.test.ts`: open with float; cash sale and cancel write `cash_sale` and `cash_sale_reverse` in the bill transaction; out and in need a note; close with variance needs a reason; variance above the setting raises one owner `exception_event`; a closed session cannot change; a sale with no open session opens one with zero float and raises an exception (billing not blocked)
- [ ] T042 [P] [US4] Write tests in `desktop/src/main/services/cash/DayCloseService.test.ts`: summary figures for a scripted day equal the hand calculation; drill-down ids point at the right documents
- [ ] T043 [US4] Implement `desktop/src/main/repositories/CashRepository.ts`, `desktop/src/main/services/cash/CashService.ts`, the `CashPort` adapter and `DayCloseService.ts` to pass T041 and T042; call `CashPort.record` from the cash-mode bill save and cancel
- [ ] T044 [US4] Register `cash.*` and `dayClose.summary`; show open owner exceptions (cash variance, clock, audit chain) after the owner signs in
- [ ] T045 [P] [US4] Build `desktop/src/renderer/features/control/CashSession/` (open, cash out and in, count by denomination with live total, variance and reason) and `DayClose/` (summary with drill-down)
- [ ] T046 [US4] Write the e2e spec `desktop/tests/e2e/dayClose.spec.ts` for quickstart 4 (steps needing 003 and 004 are skipped with a note until they merge); time SC-003

---

## Phase 7: User Story 5 - Problem report button (M4, 20 to 21 Mar; P2)

**Independent Test**: quickstart 5.

- [ ] T047 [P] [US5] Write tests in `desktop/src/main/services/reports/ProblemReportService.test.ts`: text, photo and voice stored with screen, user and time; attachments copied into the data folder; `EMPTY_REPORT`; export zip holds reports and attachments
- [ ] T048 [US5] Implement `desktop/src/main/services/reports/ProblemReportService.ts` and `ReportRepository.ts` to pass T047; `reports.*` commands
- [ ] T049 [US5] Change feature 018's permission policy in `desktop/src/main/app/permissionPolicy/` to allow audio `media` for the app's own origin only while `reports.armMicrophone` is armed (2 minutes), with a test in `desktop/tests/unit/permissionPolicy.test.ts`; record the change in `specs/018-electron-hardening/research.md`
- [ ] T050 [P] [US5] Build `desktop/src/renderer/features/control/ProblemReport/` (button in the app shell on every screen; text, photo pick or paste, voice record with a stop button)
- [ ] T051 [US5] Write the e2e spec `desktop/tests/e2e/problemReport.spec.ts` for quickstart 5 (voice recording with a fake media stream)

---

## Phase 8: Polish and cross-cutting

- [ ] T052 [P] Check every new screen in System, Light and Dark (quickstart 6)
- [ ] T053 [P] Move all new screen text into `desktop/src/renderer/strings.ts`
- [ ] T054 Add the owner PIN recovery procedure (recovery code, and the restore fallback) to the written restore guide from 001
- [ ] T055 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`
- [ ] T056 Two-week trial with 001's M6: record SC-001, SC-003, SC-004, SC-005 in `specs/005-roles-approvals-audit/plan.md`

---

## Dependencies and execution order

```
Setup --> Foundational (core, schema, guard, audit writer) --> US1 --> US2 --> US3 --> US4 --> US5 --> Polish
```

- US2 needs US1's users and PINs. US3 coverage (T037) touches every service, so it follows US2. US4 needs US1 (who opens and closes). US5 is independent after US1.

## Parallel examples

- Phase 2: T004 to T009 together.
- US1: T024, T025, T026 together.
- US4: T041 and T042 together.

## Implementation strategy

1. MVP slice: Foundational + US1 (PINs, roles, lock). Everything after it records a real user.
2. US2 and US3 together make the owner's control loop; then US4 for daily cash trust.
3. The guard PR (T018) and the audit coverage PR (T037) are each one concern.
