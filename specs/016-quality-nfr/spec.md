# Feature Specification: Cross-Cutting Quality Requirements

**Feature Branch**: `016-quality-nfr` (no git repository yet; directory name only)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Turn the PRD's quality expectations (NFR-001 to NFR-016) into testable requirements and a verification routine that every feature must meet: speed, offline, no lost bills, backup, reliability, security, privacy, learning, accessibility, language, devices, size, traceability, flexibility."

**PRD source**: `docs/reference/PRD.md` section 12 (NFR-001 to NFR-016), section 15 (success metrics, guardrails), risks (offline bills lost, sync).

**Depends on**: Applies to every feature spec. This spec owns the verification routine; the individual features own the behaviour.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Speed budgets are measured, not assumed (Priority: P1)

The shop experiences instant search, one-second bill save and print, and a fast owner card. A repeatable benchmark with a realistic dataset measures these on ordinary shop hardware before every release.

**Why this priority**: Speed at the counter drives adoption, and slow billing is the main reason staff bypass the system.

**Independent Test**: Load 50,000 items and 500 bills a day of history, then run the benchmark and compare each result with its budget.

**Acceptance Scenarios**:

1. **Given** 50,000 items on an ordinary shop PC, **Then** search results appear in about a fifth of a second (NFR-001).
2. **Given** any bill, **Then** saving and printing takes about 1 second even offline (NFR-002).
3. **Given** the owner's phone on an ordinary connection, **Then** the Today card opens within 3 seconds (NFR-003).
4. **Given** 5 counters, 5 locations, 500 bills a day and 10 years of data, **Then** these speeds still hold (NFR-014).

---

### User Story 2 - Offline and no-lost-bill testing (Priority: P1)

All counter functions work for at least 7 days offline and sync within a minute of reconnecting. Zero bills are lost or duplicated; if two counters change the same stock, both changes are kept. A fixed test routine is run before every release.

**Why this priority**: The PRD ranks lost or duplicated offline bills as the most damaging risk.

**Independent Test**: Run the offline routine: 2 counters and a phone offline for 7 simulated days, random failures and restarts, then reconnect and compare totals.

**Acceptance Scenarios**:

1. **Given** the routine, **Then** every bill appears exactly once on every device after sync (NFR-004, NFR-005).
2. **Given** a crash mid-save, **Then** the bill either exists complete or does not exist, never half-saved.
3. **Given** two counters sell the last unit, **Then** both sales are kept and stock is flagged negative.
4. **Given** a release candidate, **Then** it cannot ship with an open defect that can lose or duplicate bills.

---

### User Story 3 - Backup, restore and reliability (Priority: P1)

Encrypted cloud backup runs every 15 minutes when online and a daily copy goes to a second drive or USB. A lost computer is replaced and restored in 30 minutes or less. Online services are available at least 99.5% of each month, and the counter never depends on them.

**Why this priority**: Protects against the builder or the hardware being a single point of failure.

**Independent Test**: Wipe a test computer, restore from backup using the written guide, and time it.

**Acceptance Scenarios**:

1. **Given** online, **Then** a backup runs every 15 minutes (NFR-006).
2. **Given** a restore on a clean computer by someone other than the builder, **Then** the shop is running within 30 minutes.
3. **Given** a month of service, **Then** online availability is measured against 99.5% (NFR-007).

---

### User Story 4 - Security and privacy checks (Priority: P1)

Shop data is protected in storage and in transit, PINs are never stored readably, and the owner can remotely log out a lost device. Customer consent records and access logs (kept at least 1 year) exist, and a breach response plan describes informing affected people and the Board with a detailed report within 72 hours.

**Why this priority**: Customer data duties begin 13 May 2027, and trust depends on it.

**Independent Test**: Inspect storage for plain PINs, intercept traffic to confirm encryption, revoke a device, and run a breach drill.

**Acceptance Scenarios**:

1. **Given** the stored data, **Then** PINs are not readable and sensitive data is protected (NFR-008).
2. **Given** a lost device, **Then** the owner can log it out remotely.
3. **Given** a breach drill, **Then** the plan names who informs whom and produces a detailed report within 72 hours (NFR-009).
4. **Given** access activity, **Then** logs are kept at least 1 year.

---

### User Story 5 - Learnability, accessibility, language and traceability (Priority: P2)

A new counter staff member bills 5 lines unaided after 2 hours of training. Screens use large tap targets, readable contrast and never show information by colour alone. English at launch with room for other languages, Indian number format, and every report number traceable to its source in 3 taps or fewer. Shop rules (limits, rates, classes) change without a new release and tax rates carry effective dates.

**Why this priority**: These shape daily use and trust but are verified later in each feature's trial.

**Independent Test**: Train a new staff member for 2 hours and time 5 lines unaided; run an accessibility review; trace 10 report numbers to documents.

**Acceptance Scenarios**:

1. **Given** a new staff member after 2 hours of training, **Then** they bill 5 lines unaided (NFR-010).
2. **Given** an accessibility review, **Then** tap targets, contrast and non-colour cues pass (NFR-011).
3. **Given** a report figure, **Then** its documents open in 3 taps or fewer (NFR-015).
4. **Given** a shop rule such as a limit, **Then** it changes in settings without a release (NFR-016).

---

### Edge Cases

- A budget slightly missed on slow hardware: recorded as a known risk with the hardware named, not hidden.
- Benchmark dataset too clean: the routine includes messy data (duplicates, long names, Hindi names).
- Restore test passes only for the builder: it must be repeated by another person.
- Backup succeeds but cannot restore: a backup is counted only after a successful test restore.
- A feature meets its own spec but breaks a budget elsewhere: the release is held.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Item search MUST feel instant (about a fifth of a second) with 50,000 items on an ordinary shop PC (NFR-001).
- **FR-002**: Saving and printing a bill MUST take about 1 second, including offline (NFR-002).
- **FR-003**: The owner's Today card MUST open within 3 seconds on a phone connection (NFR-003).
- **FR-004**: All MVP counter functions MUST work for at least 7 days offline and sync within a minute of reconnecting (NFR-004).
- **FR-005**: There MUST be zero lost or duplicated bills across offline counters, and both changes to the same stock MUST be kept (NFR-005).
- **FR-006**: Encrypted cloud backup MUST run every 15 minutes when online, a daily copy MUST go to a second drive or USB, and a lost computer MUST be restorable in 30 minutes or less (NFR-006).
- **FR-007**: The counter MUST never depend on the internet to bill; online services MUST be available at least 99.5% of each month (NFR-007).
- **FR-008**: Data MUST be protected in storage and transit; PINs MUST NOT be stored readably; the owner MUST be able to log out a lost device remotely (NFR-008).
- **FR-009**: Consent records and access logs (at least 1 year) MUST be kept and a breach response plan MUST exist (NFR-009).
- **FR-010**: A new counter staff member MUST bill 5 lines unaided after 2 hours of training (NFR-010).
- **FR-011**: UI MUST use large tap targets, readable contrast and never rely on colour alone (NFR-011).
- **FR-012**: Language support and Indian number format MUST follow feature 014 (NFR-012).
- **FR-013**: Devices and printers MUST follow feature 015 (NFR-013).
- **FR-014**: The system MUST handle 50,000 items, 5 counters, 5 locations, 500 bills a day and 10 years of data without slowing down (NFR-014).
- **FR-015**: Every report number MUST trace to source documents in 3 taps or fewer (NFR-015).
- **FR-016**: Rules (limits, rates, classes) MUST be changeable by the shop without a release and tax rates MUST carry effective dates (NFR-016).
- **FR-017**: A release routine MUST run the speed, offline, backup-restore, security and accessibility checks before every shop release, and failures MUST block the release.

### Key Entities

- **Benchmark Dataset**: Generated and messy data at target scale.
- **Benchmark Run**: Date, version, hardware, results versus budgets.
- **Offline Test Run**: Scenario, devices, injected faults, comparison result.
- **Restore Test**: Who, machine, time taken, outcome.
- **Security Check**: Item, result, evidence.
- **Release Gate Record**: Version and pass or fail per check.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every release has a recorded benchmark result with all budgets met or an explained, accepted miss.
- **SC-002**: Zero lost or duplicated bills across the offline routine on every release.
- **SC-003**: A restore by a person other than the builder takes 30 minutes or less, tested at least once before go-live and after every major change to backup.
- **SC-004**: No stored PIN is readable in an inspection of the database and logs.
- **SC-005**: Sync health: days with unsynced data older than 24 hours stays at 0.
- **SC-006**: A new staff member reaches 5 unaided lines after 2 hours of training in the trial.

## Assumptions

- Budgets are goals until measured; baselines are set in Phase 0 and targets may reset then (PRD note).
- "Ordinary shop PC" means the owner's actual counter computer, recorded in the benchmark run.
- Online availability applies only once the server (010) exists.
- The benchmark and offline routines are automated test jobs in the repository, planned in this feature's plan.
- These requirements apply to every feature spec; per-feature specs point here instead of repeating them.
