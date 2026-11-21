# Contract: commands added or changed by feature 005

Feature 001's IPC validation and sender checks apply to every command. Before dispatch, main requires an explicit guard policy; an undeclared command is refused. Protected commands require an unlocked session and the declared permission checked against current grants. Errors include `NOT_SIGNED_IN`, `SESSION_LOCKED`, `PERMISSION_DENIED` and `APPROVAL_REQUIRED` (`{ kind, amountPaise, detail }`).

**Request-mode commands** (a permission whose mode is `request` for the user's role, for example `bill.cancel` for a Manager): the command input carries `approvalId?`. Without it, the guard returns `APPROVAL_REQUIRED` and the screen opens the approval prompt. With it, the guard admits the call when that request is `approved`, unused, unexpired and of the command's kind, and does **not** return `APPROVAL_REQUIRED`; the service then calls `ApprovalPort.consume` inside its transaction, which also checks the subject and amount, so a wrong or reused approval still fails with `APPROVAL_INVALID` and writes nothing. Example: a Manager cancels C1/26-27/000123, the Owner approves at the counter, and the retry with `approvalId` cancels it once.

Session commands use these guards in main:

- `session.setupOwner`: no session required. Check for zero user rows and create the first owner in one transaction; otherwise return `ALREADY_SET_UP`.
- `session.signIn` and `session.switchUser`: no active session required. Verify the target user's active status, lockout and PIN before establishing or replacing the session. Either can unlock; a failed attempt never unlocks the previous session.
- `session.recoverOwner`: no session required. Rate-limit attempts; require an active owner's unused recovery code, reset the PIN and rotate the code atomically. Sign-in is still required afterwards.
- `session.current`: available signed out or locked; return only session display state, never credentials.
- `session.lock` and `session.signOut`: may lock or clear the calling session even when locked; idempotent when signed out. Neither grants access.
- `session.touch`: requires an unlocked session; activity alone cannot unlock it.

## Session and users

| Command                                                            | Input                                                    | Result                                        | Error codes                                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| `session.setupOwner`                                               | `{ name, pin }` (only when no user exists)               | `{ user, recoveryCode }` (shown once)         | `ALREADY_SET_UP`, `INVALID_PIN`                                                |
| `session.signIn`                                                   | `{ userId, pin }`                                        | `{ user, role, permissions }`                 | `WRONG_PIN` (`{ attemptsLeft }`), `USER_LOCKED` (`{ until }`), `USER_INACTIVE` |
| `session.switchUser`                                               | `{ userId, pin }`                                        | as `signIn`; the renderer keeps its open work | as `signIn`                                                                    |
| `session.lock` / `session.signOut`                                 | `{}`                                                     | `{}`                                          |                                                                                |
| `session.touch`                                                    | `{}` (throttled by the renderer to once every 10 s)      | `{ lockAtMs }`                                |                                                                                |
| `session.current`                                                  | `{}`                                                     | `{ user?, isLocked }`                         |                                                                                |
| `session.recoverOwner`                                             | `{ recoveryCode, newPin }`                               | `{ newRecoveryCode }`                         | `WRONG_RECOVERY_CODE` (lockout as PINs)                                        |
| `users.list` / `users.save` / `users.setActive` / `users.resetPin` | owner only                                               | `{ users[] }` / `{ user }`                    | `LAST_OWNER` (cannot deactivate the only owner), `INVALID_PIN`                 |
| `roles.list` / `roles.setPermission`                               | `{}` / `{ roleCode, permission, mode, thresholdPaise? }` | `{ roles[{ role, permissions[] }] }`          | `UNKNOWN_PERMISSION`                                                           |

Only an active owner may administer users, roles and the manager delegation setting. The Roles screen saves delegated approval kinds independently of action mode via the owner settings command.

## Approvals

| Command                     | Input                                                                           | Result                                           | Error codes                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `approvals.request`         | `{ kind, subjectType, subjectId, amountPaise?, detail }`                        | `{ approval }` (status `requested`, `expiresAt`) |                                                                                                                                                     |
| `approvals.decideAtCounter` | `{ approvalId, approverUserId, pin, decision: "approve" or "reject", reason? }` | `{ approval }`                                   | `WRONG_PIN`, `NOT_ALLOWED_TO_APPROVE`, `SELF_APPROVAL`, `EXPIRED`, `ALREADY_DECIDED` (the second decision is logged and ignored), `REASON_REQUIRED` |
| `approvals.get`             | `{ approvalId }`                                                                | `{ approval }`                                   | `NOT_FOUND`                                                                                                                                         |
| `approvals.list`            | `{ from?, to?, status?, kind? }`                                                | `{ approvals[] }`                                |                                                                                                                                                     |

`ApprovalPort` (used by 002, 003, 004, 007): `consume(approvalId, { kind, subjectType, subjectId, amountPaise })` inside the caller's transaction; fails with `APPROVAL_INVALID` when the kind, subject or amount differ, or the approval is not `approved`, is expired or was consumed.

## Audit

| Command        | Input                                                                     | Result                      | Error codes    |
| -------------- | ------------------------------------------------------------------------- | --------------------------- | -------------- |
| `audit.list`   | `{ from?, to?, userId?, action?, entityType?, entityId?, limit, offset }` | `{ entries[], total }`      |                |
| `audit.verify` | `{}` (also at start and nightly)                                          | `{ checked, brokenAtSeq? }` |                |
| `audit.export` | `{ from, to, filePath }` (requires `data.export`; itself audited)         | `{ filePath }`              | `WRITE_FAILED` |

There is no command that updates or deletes an audit entry.

`AuditPort` (used by every writing service): `record({ action, entityType, entityId, before, after, reason })` inside the caller's transaction.

## Cash and day-close

| Command                                | Input                                              | Result                                                                                                  | Error codes                         |
| -------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `cash.open`                            | `{ openingFloatPaise }`                            | `{ session }`                                                                                           | `SESSION_ALREADY_OPEN`              |
| `cash.current`                         | `{}`                                               | `{ session, expectedPaise, entries[] }`                                                                 | `NO_OPEN_SESSION`                   |
| `cash.out`                             | `{ kind: "expense" or "drop", amountPaise, note }` | `{ entry }`                                                                                             | `NOTE_REQUIRED`, `NO_OPEN_SESSION`  |
| `cash.in`                              | `{ amountPaise, note }`                            | `{ entry }`                                                                                             | `NOTE_REQUIRED`                     |
| `cash.startCount` / `cash.cancelCount` | `{}`                                               | `{ session }`                                                                                           |                                     |
| `cash.close`                           | `{ denominations, varianceReason? }`               | `{ session, variancePaise, alerted }`                                                                   | `REASON_REQUIRED`, `COUNT_MISMATCH` |
| `dayClose.summary`                     | `{ businessDate?, counterCode? }`                  | `{ salesByMode, pendingUpi, creditGiven, collections, returns, cancels, approvals, cash, documentIds }` |                                     |

`CashPort` (used by billing, payments, returns): `record({ kind, amountPaise, docType, docId })` inside the caller's transaction; with no open session the entry opens one with a zero float and raises an exception for the owner (billing is never blocked).

## Problem reports

| Command                              | Input                                                | Result                                           | Error codes    |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------------------------ | -------------- |
| `reports.create`                     | `{ screen, text?, photoFilePath?, voiceRecording? }` | `{ report }`                                     | `EMPTY_REPORT` |
| `reports.list` / `reports.setStatus` |                                                      | `{ reports[] }` / `{ report }`                   |                |
| `reports.export`                     | `{ filePath }`                                       | `{ filePath }` (zip of reports and attachments)  | `WRITE_FAILED` |
| `reports.armMicrophone`              | `{}`                                                 | `{ armedUntilMs }` (2 minutes; see research D10) |                |
