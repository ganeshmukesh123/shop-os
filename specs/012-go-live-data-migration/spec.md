# Feature Specification: Go-Live, Data Migration and Release Practice

**Feature Branch**: `012-go-live-data-migration` (no git repository yet; directory name only)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Take the owner's own shop from paper or a generic app to Shop OS: load items, parties and balances, set rules, train staff, run in parallel with the old method, count racks, review totals daily, pass gates, and keep a safe fortnightly release and rollback practice."

**PRD source**: `docs/reference/PRD.md` sections 1 (scope for a solo build), 3 (release scope), 15 (dependencies, rollout, go-live table, release practices, fallback), BO-1, BO-2, risks (staff bypass, dirty item data).

**Depends on**: 001 for a first trial; 002, 004, 005, 008 for the full MVP go-live. This feature adds tools and procedures, not new counter functions, except the data-loading tools.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Load the shop's data before go-live (Priority: P1)

Before go-live the owner imports at least the top 500 items and all credit parties with opening balances, and cleans duplicates. A readiness check shows what is loaded and what is missing.

**Why this priority**: The PRD makes the top 500 items and all credit parties a go-live condition, and dirty data is rated a high-likelihood, high-impact risk.

**Independent Test**: Import 500 items and 100 parties with balances, see the readiness check pass or list gaps, and merge the duplicates found.

**Acceptance Scenarios**:

1. **Given** item and party spreadsheets, **When** imported, **Then** a preview lists errors and duplicates and nothing saves until confirmed.
2. **Given** opening balances, **Then** a confirmation total must match the source before they post.
3. **Given** the readiness check, **Then** it reports item count, parties with balances, missing prices or units, and unresolved duplicate groups.
4. **Given** go-live at risk (fewer than 500 items or parties missing), **Then** the check says "not ready" with the list.

---

### User Story 2 - Settings sign-off and training (Priority: P1)

A week before go-live the owner sets tiers, roles, limits, MRP rules and paint classes, prints shelf tags, and signs off the settings. Each staff member has two one-hour training sessions, a champion is named, and each bills 5 test bills unaided.

**Why this priority**: The PRD makes staff adoption the main risk (staff bypass in rush hours).

**Independent Test**: Run a training session with a practice shop database; each trainee bills 5 test bills unaided within the session time and the champion is recorded.

**Acceptance Scenarios**:

1. **Given** a practice mode, **Then** training bills do not touch real stock, ledgers or bill numbers.
2. **Given** the settings checklist, **Then** the owner can mark each item signed off with a date.
3. **Given** a staff member, **Then** their training completion and the 5-test-bill result are recorded.

---

### User Story 3 - Parallel run and daily total check (Priority: P1)

For the first weeks the shop bills in Shop OS with the old book kept for credit only, and each evening the totals are compared. After week 2 the old billing stops. A paper bill book stays in the drawer for the first month and is back-filled the same day if used.

**Why this priority**: This is how the PRD proves 95% of sales are in the system and catches bypass.

**Independent Test**: Enter a day's paper bills and system totals side by side and see the difference; back-fill a paper bill.

**Acceptance Scenarios**:

1. **Given** an evening, **Then** the owner enters the old-book total and sees the difference against system sales and cash.
2. **Given** a paper bill used during an outage, **Then** it is back-filled with a "paper bill" reference and the same date.
3. **Given** the first four weeks, **Then** the share of sales billed in the system is shown against the 95% target.
4. **Given** bypass signs (bill count versus footfall, cash difference), **Then** the owner sees an early-warning view.

---

### User Story 4 - Gates and stock accuracy (Priority: P2)

The owner counts one rack a day, the top-200 item accuracy is measured, and a Gate 1 review at week 4 fixes the top three complaints before new features start.

**Why this priority**: Gates keep scope from creeping and the data trustworthy.

**Independent Test**: Record counts for 20 top items and see the accuracy percentage against the 95% by day 60 target.

**Acceptance Scenarios**:

1. **Given** rack counts, **Then** top-200 accuracy is shown against the target.
2. **Given** Gate 1, **Then** the owner records pass or fail and the top three complaints with their fix status.

---

### User Story 5 - Safe releases and rollback (Priority: P1)

A new version reaches the shop every 2 weeks, with new features switched on only after a 15-minute staff walkthrough. Each version passes offline testing with no open defect that can lose or duplicate bills, and the previous version stays installable for rollback. Daily backups can be restored by someone other than the builder using a written guide.

**Why this priority**: A solo builder is a single point of failure; the PRD asks for protection against it.

**Independent Test**: Install a new version, switch a feature on after a walkthrough, roll back to the previous version, and restore a backup using only the guide.

**Acceptance Scenarios**:

1. **Given** a new version, **Then** features are off by default and the owner switches each on after a walkthrough.
2. **Given** a failed release, **Then** the previous version installs and the shop's data opens.
3. **Given** the restore guide, **Then** a person other than the builder restores a backup on a clean machine.

---

### Edge Cases

- Import runs twice: duplicates detected and nothing double-posts.
- A staff member leaves mid-training: their PIN is deactivated, their records kept.
- Power or hardware failure at go-live: a second device or the owner's phone can bill offline; paper bill book is the last fallback.
- Opening balance changes after go-live: corrected by an adjustment entry, never an edit.
- Old-book total never matches: listed as an exception with the date.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST import items, parties and opening balances with previews, duplicate detection and confirmation totals before posting (FR-ITM-012, FR-KHA-008).
- **FR-002**: System MUST provide a readiness check showing items loaded, credit parties with balances, missing data and unresolved duplicates.
- **FR-003**: System SHOULD provide a training mode that does not affect real stock, ledgers or bill numbers.
- **FR-004**: System MUST let the owner record a settings sign-off checklist (tiers, roles, limits, MRP, paint classes, shelf tags).
- **FR-005**: System MUST let the owner record each staff member's training and 5-test-bill result and name a champion.
- **FR-006**: System MUST support entering old-book totals each evening and showing the difference against system sales and cash.
- **FR-007**: System MUST support back-filling paper bills with a paper-bill reference and the original date.
- **FR-008**: System MUST show the share of sales billed in the system against the 95% target, and bypass early-warning figures (bill count versus footfall, cash difference).
- **FR-009**: System MUST show top-200 accuracy from rack counts against the 95% by day 60 target and let the owner record gate decisions.
- **FR-010**: Releases MUST reach the shop every 2 weeks, with new features off until switched on, and the previous version MUST remain installable.
- **FR-011**: A written restore guide MUST exist and be tested by a person other than the builder.

### Key Entities

- **Readiness Check**: Counts and gaps at a point in time.
- **Signoff Item**: Settings checklist item with date and signer.
- **Training Record**: Staff member, sessions, test-bill result, champion flag.
- **Daily Reconciliation**: Old-book total, system total, difference, note.
- **Paper Bill Reference**: Link between a back-filled bill and its paper number.
- **Gate Review**: Gate, date, outcome, complaints and fix status.
- **Feature Switch**: Feature, state, switched-on date and walkthrough record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of sales are billed in Shop OS with stock deducted within 4 weeks of go-live.
- **SC-002**: Top 500 items and all credit parties are loaded 14 days before go-live.
- **SC-003**: Each staff member bills 5 test bills unaided before go-live.
- **SC-004**: Evening totals match every day of the first week.
- **SC-005**: Top-200 stock accuracy reaches 95% by day 60.
- **SC-006**: A person other than the builder restores a backup on a clean machine in 30 minutes or less.

## Assumptions

- Go-live is planned for 1 June 2027 with a parallel run to 28 June (PRD), but the first trial of the reduced MVP (001) is earlier and uses the same procedures at smaller scope.
- Staff count is assumed to be 3 to 8 with one counter (PRD assumption to confirm).
- Training mode and the reconciliation screens are small additions; most go-live work is procedure and checklists.
- The feature-switch mechanism is a simple settings list, not a remote flag service.
