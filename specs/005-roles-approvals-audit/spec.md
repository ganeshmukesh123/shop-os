# Feature Specification: Roles, Approvals, Audit Log and Cash Day-Close

**Feature Branch**: `005-roles-approvals-audit`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "PIN login with roles and editable permissions, auto-lock and quick user switch, approvals for risky actions with owner PIN or remote approval, discount limits, an immutable audit log, cash drawer and day-close, and a problem-report button."

**PRD source**: `docs/reference/PRD.md` section 10 Control (FR-CTL-001 to 008), permissions table (section 15), US-03, US-09, EC-10, EC-20, EC-03.

**Depends on**: 001 (bills). Provides approval and limits to 003, 004, 007. Remote approval needs 010 (owner phone app); on-device PIN approval works without it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - PIN login and roles (Priority: P1)

Users sign in with a 4-6 digit PIN. Roles are Owner, Manager, Counter, Godown and Accountant; each role's permissions are editable by the owner. The screen locks after 5 minutes idle (configurable) and another user can switch quickly by PIN.

**Why this priority**: Without identity there is no accountability, approval or audit.

**Independent Test**: Sign in as each role and verify the permissions table; idle for 5 minutes and see the lock; quick-switch users.

**Acceptance Scenarios**:

1. **Given** the default permissions table, **Then** each role can do only what it lists (for example Counter cannot export data and Godown cannot create bills).
2. **Given** idle time beyond the setting, **Then** the screen locks and a PIN is needed.
3. **Given** a quick user switch, **Then** the next user's PIN replaces the current session without closing work in progress.
4. **Given** PINs, **Then** they are never stored readably.
5. **Given** the owner edits a permission, **Then** it applies from the next action and the change is audit-logged.

---

### User Story 2 - Approvals for risky actions (Priority: P1)

Below-cost price, discount over limit, credit over limit, bill cancel, return without bill, stock adjustment over threshold and edit after save need approval. The owner approves by PIN on the device or remotely within 2 minutes; a request that times out leaves the action unsaved. A Manager with delegated approval can approve if the owner is unreachable.

**Why this priority**: This is how the owner controls the shop without standing at the counter.

**Independent Test**: Trigger each approval type; approve, reject and time out; check the audit log for each.

**Acceptance Scenarios**:

1. **Given** a below-cost line, **When** the owner enters their PIN, **Then** the line saves and is logged.
2. **Given** a remote request unanswered for 2 minutes, **Then** it expires and the action stays unsaved.
3. **Given** the owner is unreachable and the Manager role has delegated approval, **Then** a Manager can approve (EC-10).
4. **Given** a rejection, **Then** a reason is recorded and the line returns to the bill for correction.
5. **Given** discount limits per role and per user (percent and rupees per bill), **Then** discounts above them need approval.

---

### User Story 3 - Immutable audit log (Priority: P1)

Every create, edit, cancel, approval, login, export and setting change is recorded with user, device, time and before and after values. No role can edit or delete the log. Bills' records are kept at least 7 years and access logs at least 1 year.

**Why this priority**: The owner's trust in staff behaviour depends on it, and regulation requires retention.

**Independent Test**: Edit an item price and approve a cancel, then confirm entries with before and after values; try to delete an entry (not possible).

**Acceptance Scenarios**:

1. **Given** any listed action, **Then** an entry exists with user, device, time, before and after.
2. **Given** any role including Owner, **Then** no edit or delete of entries is possible.
3. **Given** a device whose clock is wrong, **Then** server time is recorded alongside device time and the owner is alerted if the difference exceeds 10 minutes (EC-20; needs 010 for server time).

---

### User Story 4 - Cash drawer and day-close (Priority: P1)

At day start the manager enters the opening float. At close they count cash by denomination; the system shows expected cash (cash sales + cash receipts − cash refunds − cash expenses − deposits), records the difference with a required reason, lists pending UPI, and notifies the owner when the difference exceeds a set amount. A day-close summary shows sales by payment mode, pending UPI, credit given, collections, returns, cancels, approvals and the cash difference.

**Why this priority**: Daily cash trust is a stated owner goal and the parallel-run check.

**Independent Test**: Expected cash 18,450 with a count of 18,200: the −250 difference needs a reason and notifies the owner if above the threshold.

**Acceptance Scenarios**:

1. **Given** the day's activity, **Then** expected cash is calculated as above.
2. **Given** a counted total different from expected, **Then** the difference is stored with a mandatory reason.
3. **Given** a difference above the owner's threshold, **Then** the owner is notified.
4. **Given** pending UPI at close, **Then** they are listed.
5. **Given** the summary, **Then** all listed figures show and each drills down to documents.

---

### User Story 5 - Problem report button (Priority: P2)

On every screen a button lets any user send a problem report with text, a photo or a voice note, tagged with the screen and the user, to a list for the owner and builder.

**Why this priority**: Feedback from staff is the main usability signal during the trial.

**Independent Test**: Send reports with text, photo and voice from two screens and see them in the list with tags.

**Acceptance Scenarios**:

1. **Given** any screen, **Then** the button is visible and opens a report form.
2. **Given** a submitted report, **Then** it appears in the owner's list with screen, user and time.

---

### Edge Cases

- Owner forgets their PIN: recovery needs a documented reset (to be designed in planning, not assumed).
- Approval requested while offline: on-device PIN works; remote approval waits for connection and expires at 2 minutes.
- Two approvals for the same action: the first decides, the second is ignored and logged.
- A role loses a permission while a user holds an open screen: the next protected action is refused.
- Lost or stolen device: owner revokes it remotely (EC-03; needs 010).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST sign in with a 4-6 digit PIN under roles Owner, Manager, Counter, Godown, Accountant with editable permissions per role (FR-CTL-001).
- **FR-002**: System MUST auto-lock after 5 minutes idle (configurable) and support quick user switch by PIN (FR-CTL-002).
- **FR-003**: System MUST require approval for below-cost price, discount over limit, credit over limit, bill cancel, return without bill, stock adjustment over threshold and edit after save; approval by owner PIN on device or remotely within 2 minutes; timed-out requests leave the action unsaved (FR-CTL-003).
- **FR-004**: System MUST support a discount limit per role and per user in percent and rupees per bill (FR-CTL-004).
- **FR-005**: System MUST keep an immutable audit log of every create, edit, cancel, approval, login, export and setting change with user, device, time and before and after values; bills' records kept at least 7 years and access logs at least 1 year (FR-CTL-005).
- **FR-006**: System MUST manage the cash drawer with opening float, denomination count, expected cash, a reasoned difference and an owner notification above a threshold (FR-CTL-006).
- **FR-007**: System MUST produce a day-close summary (FR-CTL-007).
- **FR-008**: System SHOULD provide a problem-report button on every screen with text, photo or voice note, tagged with screen and user (FR-CTL-008).
- **FR-009**: PINs MUST NOT be stored readably (NFR-008).
- **FR-010**: System MUST default to the PRD's permissions table, editable by the owner (section 15).

### Key Entities

- **User / Role / Permission**: Person with PIN hash and role; role has permission set.
- **Approval Request**: Action, requester, deciding user, outcome, reason, times, channel.
- **Audit Entry**: Immutable record of an action with before and after values.
- **Discount Limit**: Per role or user, percent and rupee ceilings.
- **Cash Day**: Opening float, denomination counts, expected, actual, difference, reason.
- **Problem Report**: Message, attachment, screen, user, time, status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of risky actions in the trial show an approval record or are blocked.
- **SC-002**: Zero audit entries can be edited or deleted by any role in a deliberate test.
- **SC-003**: Day-close takes the manager under 5 minutes and the daily cash difference stays within an agreed small amount.
- **SC-004**: Approval requests are answered in median under 30 seconds.
- **SC-005**: The owner reviews day-close on at least 6 days of 7.

## Assumptions

- The permissions table in the PRD (Owner, Manager, Counter, Godown, Accountant) is the default; discount percentages (Manager 10%, Counter 3%) are examples the owner sets.
- Remote approval, remote device revoke and server time need the owner app and sync (010); until then approval is by PIN on the device.
- PIN reset and recovery procedure is an open design question for planning.
- Delegated approval for Managers is an owner setting.
