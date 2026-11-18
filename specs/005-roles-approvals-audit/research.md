# Research: Roles, Approvals, Audit Log and Cash Day-Close

**Feature**: `specs/005-roles-approvals-audit/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD section 10 Control (FR-CTL-001 to 008), the permissions table in section 15, NFR-008, NFR-009, EC-03, EC-10, EC-20, the architecture reference sections 7.1, 11.2 (approval state machine), 11.8 (cash session) and 12.3 (security), the constitution v2.1.0 (principle I: edits by a permitted role; "audit records are append-only"), feature 018's permission and navigation policies (in progress on `feat/018-permissions-navigation`), and the plans of 002, 003 and 004 that call this feature.

**Build order** (002 research D16): right after 002 and before 004 and 003, because both use its approvals, roles and audit log.

## Decisions

### D1. PIN hashing with Node's built-in scrypt, plus lockout

- **Decision**: PINs (4 to 6 digits) are hashed with `crypto.scrypt` (N = 2^17, r = 8, p = 1, 16-byte random salt, 32-byte key), stored as `scrypt$N$r$p$salt$hash`. After 5 wrong PINs for a user, that user is locked for 30 seconds, doubling each time to at most 15 minutes; the owner can unlock.
- **Rationale**: NFR-008 ("PINs are never stored readably"). The architecture names Argon2id; OWASP's Password Storage Cheat Sheet ranks Argon2id first and scrypt as the choice "where Argon2id is not available". Argon2id in Node needs a native package (`argon2`) or a WebAssembly one, and this project already fights one native module (better-sqlite3's Electron build, CLAUDE.md). scrypt is built into Node, so no package and no native build.
- **Honest limit**: a 6-digit PIN has only 1,000,000 values, so any hash can be brute-forced by someone who has the database file. The real protection is the lockout (online guessing) and, for the file, database encryption (001 D4, deferred) and the OS account. Recorded so nobody relies on the hash alone.
- **Open item OI-1**: if the Electron version in use exposes Node's built-in `crypto.argon2` (added to Node in the 24.x line; not yet checked against Electron 43's Node), switch the algorithm then; the stored format names its algorithm, so old hashes keep working.

### D2. Owner PIN recovery: a printed recovery code

- **Decision** (the spec says "to be designed in planning, not assumed"): when the owner account is created, the app shows a 12-character recovery code once (letters and digits without look-alike characters, grouped `XXXX-XXXX-XXXX`) and asks the owner to write it down or print it. Only its scrypt hash is stored. "Forgot PIN" on the owner's sign-in asks for the recovery code and a new PIN, then shows a new recovery code. Each use is audit-logged. Other users' PINs are reset by the owner.
- **If the code is lost**: there is no back door in the app. The fallback is the written restore guide (001): restore the database from backup onto the app freshly installed and set up a new owner. Data is kept; the audit log records the new owner. This is a support procedure, not a feature.
- **Alternatives rejected**: a builder-held master key (a back door); recovery through email or SMS (needs a server and an account, feature 010).
- **Owner decision OD-1**: accept the recovery-code design.

### D3. Permissions are checked in the main process on every command

- **Decision**: the main process holds the signed-in session (user, role, device). Every IPC handler declares the permission it needs; a wrapper checks it with `checkPermission(rolePermissions, permission)` from `@shopos/core` before the service runs and returns `PERMISSION_DENIED` or `APPROVAL_REQUIRED`. The renderer hides buttons a role cannot use, but the check that counts is in the main process ("never trust the client", architecture 12.3).
- **Permission modes** (`role_permission.mode`): `allow`, `request` (needs an approval), `approve` (may approve others' requests of that kind, used for delegated managers), `deny`. This expresses every cell of the PRD's table, including "Request", "Approve if delegated" and "Up to threshold" (`allow` with a threshold setting).
- **Changes apply from the next action** (spec US1 scenario 5): permissions are read per command, not cached per session.

### D4. Default permissions from the PRD

The seeded `role_permission` rows reproduce the PRD's section 15 table exactly (see `data-model.md`, "Seeded permissions"), with Manager discount 10% and Counter 3% as editable defaults (spec assumption). The owner edits them on a Roles screen; each change is audited.

### D5. Approvals: single-use, bound, 2-minute expiry, local first

- **Decision**: `approval_request` holds kind (`below_cost`, `over_discount`, `over_credit`, `cancel`, `return_without_bill`, `tinted_return`, `stock_adjust_over_threshold`, `edit_after_save`), subject (type and id, for example the draft bill's `client_bill_id`), the exact amount or value, a JSON detail shown to the approver, requester, device, status and expiry (2 minutes). Status moves only along the architecture's state machine (requested to approved, rejected or expired; approved to consumed or expired), enforced by a trigger.
- **On-device approval**: the approver types their PIN into the prompt on the same counter. The approver must hold `approve` for that kind (owner always; manager when delegated, EC-10). The requester cannot approve their own request.
- **Consumption**: the service that saves the bill, cancel, return or adjustment calls `ApprovalPort.consume(approvalId, subject, amount)` inside its transaction; a mismatch, a second use or an expired approval fails (`APPROVAL_INVALID`). "Two approvals for the same action: the first decides, the second is ignored and logged."
- **Rejection** needs a reason; the screen puts the line back for correction.
- **Remote approval** (owner's phone) is feature 010. Until then a request waits only for an on-device PIN; offline remote requests are not possible.

### D6. Audit log: append-only, hash-chained, local

- **Decision**: `audit_log(seq, action, entity_type, entity_id, user_id, device_id, device_time, before_json, after_json, reason, prev_hash, row_hash)`. `seq` increases by one per business; `row_hash` = SHA-256 over `prev_hash` and the canonical JSON of the row (keys sorted). Triggers reject UPDATE and DELETE; a start-up and nightly check walks the chain and raises an `exception_event` if any link breaks (SC-002, architecture 12.3).
- **What is logged** (FR-005): creates, edits and deactivations of items, prices, parties, users, roles, permissions and settings; bill saves, edits (003) and cancels; returns; approvals requested and decided; sign-in, sign-out, failed PINs, lockouts, PIN resets; exports; backups and restores. One `AuditPort.record` call inside the same transaction as the change.
- **Retention**: entries are never deleted by the app. FR-005 asks for "at least 7 years" for bills and "at least 1 year" for access logs; keeping everything meets both. Size estimate: about 600 entries a day at 1 KB is about 220 MB a year; a purge of access entries older than the legal minimum can be added later if size hurts (OI-3).
- **Clock (EC-20)**: server time needs 010. Offline, the app records device time and flags an `exception_event` when a new entry's device time is more than 10 minutes earlier than the previous entry's (the clock went backwards).

### D7. Cash sessions and the expected-cash formula

- **Decision**: `cash_session` per counter and business date (open, counting, closed, architecture 11.8) with opening float; `cash_entry` append-only rows written in the same transaction as the event: `opening_float`, `cash_sale` (cash tender of a bill), `cash_receipt` (khata payment, 004), `cash_refund` (return, 003), `cash_expense`, `cash_drop` (deposit to bank or safe), `cash_in_other`. Expected = sum of entries with signs (architecture formula). Variance = counted minus expected; a reason is required when it is not zero.
- **Example**: float ₹2,000 + cash sales ₹19,200 + receipts ₹1,500 - refunds ₹250 - expenses ₹1,000 - deposit ₹3,000 = expected ₹18,450; counted ₹18,200 gives -₹250, reason required.
- **Who writes cash entries**: this feature adds them to 001's bill save and cancel (cash mode) now; 004 adds them to payments and 003 to returns and split tenders, through `CashPort`.
- **Expenses**: a simple "Cash out" entry (amount, kind expense or deposit, note) is built here because the formula needs it; feature 011 adds expense categories and links them.
- **Denominations**: a setting, default ₹500, ₹200, ₹100, ₹50, ₹20, ₹10 notes and ₹20, ₹10, ₹5, ₹2, ₹1 coins (₹2,000 notes are withdrawn from circulation but remain legal tender, so the owner can add them).
- **Owner notification** above the threshold: without the phone app (010) it is an `exception_event` shown on the owner's next sign-in and at the top of the day-close summary.

### D8. Day-close summary from source documents

`buildDayCloseSummary` in core takes the day's bills, tenders, ledger entries, returns, approvals, cancels and the cash session and returns: sales by payment mode, pending UPI (003 `tenders.pendingUpi`), credit given, collections, returns, cancels, approvals and the cash difference. Each figure carries the ids of its documents so the screen drills down (NFR-015). Sections for features not yet merged (returns before 003) show "Not in use yet" rather than zero.

### D9. Session, idle lock and quick switch

- The main process keeps the session and the time of the last user action (renderer input events are reported by a throttled `session.touch`, at most once every 10 seconds). After the idle setting (default 5 minutes, 1 to 60) the main process marks the session locked and every protected command returns `SESSION_LOCKED`; the renderer shows a lock overlay **on top of** the current screen, so work in progress stays (spec US1 scenario 3).
- Quick switch: a different user's PIN on the lock overlay replaces the session; the draft bill stays and records the new user as its author when saved; the switch is audited.

### D10. Problem reports and the 018 permission policy

- Text and a photo (picked from a file or the clipboard) are stored in `problem_report` with the screen name, user and time; attachments go to the app's data folder `reports/` and are included in backups.
- **Voice notes need the microphone**, which feature 018's permission policy denies by default. Resolution: 018's policy allows `media` with audio only, only for the app's own origin, and only while the problem-report dialog is open (the dialog asks the main process to arm the permission for 2 minutes). Recorded as a change request to 018 (task in this feature).
- Reports reach the builder by an export (zip) until sync (010) carries them.

### D11. Users on rows

Nullable `user_id` columns are added to `bill`, `stock_movement` and other records written from now on (SQLite `ALTER TABLE ADD COLUMN` with a null default; no table rebuild). Older rows keep null, shown as "Before sign-in".

### D12. First run after upgrade

A database from 001 has no users. On the first start after this migration the app opens an "Owner set-up" screen (name, PIN twice, recovery code shown) before any other screen; the 001 data stays. On a fresh install the same screen follows the shop profile.

## Open items

| ID   | Item                                                                         | Resolve by                                                            | Milestone      |
| ---- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------- |
| OI-1 | Node's built-in Argon2 available in Electron 43's Node                       | Check `process.versions.node` and `crypto.argon2` in the packaged app | M1             |
| OI-2 | 018 permission-policy change for the microphone in the problem-report dialog | Agreed in 018's spec or plan                                          | M4             |
| OI-3 | Legal minimum retention for access logs and whether purging is wanted at all | Shop's CA or lawyer                                                   | Before go-live |
| OI-4 | Cash difference threshold and denomination list                              | Owner                                                                 | M4             |

## Owner decisions needed

| ID   | Question                                           | Recommendation                             | Needed by |
| ---- | -------------------------------------------------- | ------------------------------------------ | --------- |
| OD-1 | Owner PIN recovery by a printed recovery code (D2) | Yes                                        | M2        |
| OD-2 | Managers may approve by delegation for which kinds | Cancel and stock adjustment only, at first | M3        |

## References

- OWASP Password Storage Cheat Sheet (Argon2id, scrypt parameters): https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html (primary).
- Node.js `crypto.scrypt`: https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback (primary).
- NIST SP 800-63B, section 5.2.2 (rate limiting for memorised secrets): https://pages.nist.gov/800-63-3/sp800-63b.html (primary).
- Electron `session.setPermissionRequestHandler`: https://www.electronjs.org/docs/latest/api/session#sessetpermissionrequesthandlerhandler (primary).
- Crosby and Wallach, "Efficient Data Structures for Tamper-Evident Logging", USENIX Security 2009 (hash-chained logs): https://www.usenix.org/legacy/event/sec09/tech/full_papers/crosby.pdf (primary).
- Reserve Bank of India, withdrawal of ₹2000 notes from circulation (19 May 2023): https://www.rbi.org.in/ (primary).
- Industry practice: Square Point of Sale uses per-employee passcodes with role-based permissions and manager overrides (https://squareup.com/help/us/en/article/5822-employee-management-permissions, primary vendor documentation). GitHub's audit log is append-only and exportable (https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization, primary vendor documentation). Google's Trillian and Certificate Transparency use Merkle-tree logs for tamper evidence (https://certificate.transparency.dev/, primary); a simple hash chain is the single-device version of the same idea.
