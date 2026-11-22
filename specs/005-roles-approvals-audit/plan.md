# Implementation Plan: Roles, Approvals, Audit Log and Cash Day-Close

**Branch**: `005-roles-approvals-audit` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-roles-approvals-audit/spec.md`, PRD section 10 Control and the section 15 permissions table, the architecture reference sections 7.1, 11.2, 11.8 and 12.3, the constitution v2.1.0, and feature 018's permission policy.

## Summary

Give every action an accountable user. Staff sign in with a 4 to 6 digit PIN (scrypt-hashed, with lockout); five roles carry the PRD's permissions, editable by the owner; the main process enforces the IPC guard policy for each command; the screen locks after idle time without losing work, and users switch by PIN. Risky actions raise single-use, 2-minute approvals decided by an owner or delegated manager PIN on the device. Every change goes into a hash-chained, append-only audit log. A cash session per counter records cash entries in the same transactions as sales and payments, so day-close shows expected cash, a reasoned variance and a drill-down summary. A problem-report button collects text, photos and voice notes.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS (Electron 43's bundled Node in the app)

**Primary Dependencies**: Unchanged; no new package (Node `crypto.scrypt` and SHA-256; research D1).

**Storage**: Same SQLite file. New tables `app_role`, `role_permission`, `app_user`, `owner_recovery`, `device`, `approval_request`, `audit_log`, `cash_session`, `cash_entry`, `cash_count`, `problem_report`; nullable `user_id` on `bill` and `stock_movement`; settings for idle lock, variance alert, denominations, delegated kinds.

**Testing**: Vitest test-first for core (permissions, approval state machine, hash chain, expected cash, summary) and for every write that consumes approvals or records cash; tamper tests with the `sqlite3` CLI; Playwright for the quickstart.

**Target Platform**: macOS first; Windows and Linux.

**Project Type**: desktop-app (pnpm workspace).

**Performance Goals**: PIN sign-in under 300 ms (scrypt cost tuned to that on the owner's Mac); permission check under 1 ms per command; audit write adds under 5 ms to a bill save (NFR-002 still about 1 s); chain verification of 1,000,000 entries under 30 s at start (runs in the background).

**Constraints**: Offline (remote approval is 010); audit append-only; no back door for PINs; work in progress survives lock and switch.

**Scale/Scope**: Up to 15 users, 5 roles, about 600 audit entries a day; 8 screens or dialogs (owner set-up, sign-in and lock, users, roles, approval prompt, audit viewer, cash and day-close, problem report).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle                         | How this plan satisfies it                                                                                                                                         | Status                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| I. Saved bill versions            | Supplies the roles and the audit log that principle I requires before same-day edits (003) are allowed; no bill is changed here                                    | Pass                             |
| II. Immutable records             | `audit_log` and `cash_entry` append-only by trigger; audit hash chain verified at start and nightly; expected cash derived from entries                            | Pass                             |
| III. Integers                     | Cash in paise; denominations in paise                                                                                                                              | Pass                             |
| IV. Offline-first                 | PIN approval on the device; remote parts wait for 010; a missing cash session never blocks billing                                                                 | Pass                             |
| V. UI-free core                   | Permission, approval, chain, cash and summary rules in core                                                                                                        | Pass                             |
| VI. Test-first                    | Core and every write that consumes approvals or records cash tested first                                                                                          | Pass                             |
| VII. Simplicity                   | No package; recovery by printed code; reports exported as a zip until sync                                                                                         | Pass                             |
| VIII to X                         | Readable names; small dialogs; lock overlay and statuses with words; both themes                                                                                   | Pass                             |
| Privacy and records (constraints) | Audit kept indefinitely (meets 7 years and 1 year); PINs hashed; access logs kept                                                                                  | Pass; OI-3 for purge rules       |
| Electron security (constraints)   | Session and permission checks in the main process; the renderer only displays; microphone allowed only in the report dialog (change to 018's policy, research D10) | Pass once 018 accepts the change |

Post-design re-check (2026-11-18): no violations.

## Project Structure

### Documentation (this feature)

```text
specs/005-roles-approvals-audit/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
└── contracts/ipc-commands.md
```

### Source Code (repository root)

```text
packages/core/src/control/  # permissions.ts, discountLimit.ts, approvalStateMachine.ts, auditChain.ts,
                            # expectedCash.ts, denominations.ts, dayCloseSummary.ts, pinRules.ts
apps/desktop/src/main/
├── session/               # SessionManager (sign-in, lock, switch, touch), pinHasher.ts (scrypt)
├── ipc/guard.ts           # wraps each handler: declared guard policy
├── repositories/          # UserRepository, RoleRepository, ApprovalRepository, AuditRepository, CashRepository, ReportRepository
├── services/
│   ├── users/             # UserService (owner set-up, recovery, users, roles)
│   ├── approvals/         # ApprovalService + ApprovalPort adapter
│   ├── audit/             # AuditService + AuditPort adapter, chain verifier
│   ├── cash/              # CashService + CashPort adapter, DayCloseService
│   └── reports/           # ProblemReportService
apps/desktop/src/renderer/features/control/
├── OwnerSetup/, SignIn/, LockOverlay/, Users/, Roles/, ApprovalPrompt/, AuditViewer/,
├── CashSession/, DayClose/, ProblemReport/ (button in the app shell)
```

**Structure Decision**: Same two packages. Session and permission checks sit in the main process (`ipc/guard.ts`) so no handler can forget them; services take the session user as an argument (pure where possible).

## Milestone Plan

Window 22 February to 21 March 2027 (proposed, 002 research D16), right after 002.

| #     | Dates               | Milestone                                    | Exit criteria                                                                                                                                    |
| ----- | ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1    | 22 to 28 Feb        | Core rules, schema, guard                    | Core green; migrations on a copy of the owner's database; every existing command wrapped by the guard with all earlier tests green; OI-1 checked |
| M2    | 1 to 7 Mar          | Sign-in, roles, lock, switch, recovery (US1) | Quickstart 1; OD-1 answered                                                                                                                      |
| M3    | 8 to 14 Mar         | Approvals and audit (US2, US3)               | Quickstart 2 and 3; OD-2 answered                                                                                                                |
| M4    | 15 to 21 Mar        | Cash, day-close, problem reports (US4, US5)  | Quickstart 4, 5, 6; OI-2 and OI-4 answered                                                                                                       |
| Trial | with 001's M6 trial | Daily close                                  | SC-001, SC-003, SC-004, SC-005 measured over 2 weeks                                                                                             |

**Risks and fallbacks**

- Wrapping every command breaks existing flows: done in one PR with a test that lists every command and its guard policy, so none is missed.

- scrypt too slow on an old Windows PC: lower N to 2^15 (still within OWASP's minimum guidance), stored per hash.
- Staff share PINs: audit shows it only indirectly; the owner is told in the walkthrough; out of scope to prevent.

## Complexity Tracking

| Addition                                        | Why it is needed                                              | Simpler alternative rejected because                  |
| ----------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| Hash chain on `audit_log`                       | Tamper evidence beyond triggers (SC-002; architecture 12.3)   | Triggers alone can be dropped by anyone with the file |
| Ports (`ApprovalPort`, `AuditPort`, `CashPort`) | 002, 003, 004 and 007 call them inside their own transactions | Direct service calls create cycles between features   |
| Permission guard around every IPC handler       | One place to enforce roles                                    | Checks inside each service are easy to forget         |
