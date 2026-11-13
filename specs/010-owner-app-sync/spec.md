# Feature Specification: Owner and Godown Phone Apps, Sync and Cloud Backup

**Feature Branch**: `010-owner-app-sync` (no git repository yet; directory name only)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "An owner Android app with a Today card, drill-down, ranked alerts and remote approvals; a godown phone app for receiving and counting; server sync that never loses or duplicates bills across devices; push notifications; encrypted cloud backup; remote device revoke."

**PRD source**: `docs/reference/PRD.md` section 10 Owner app (FR-OWN-001 to 005), NFR-001 to NFR-016, US-10, EC-01, EC-02, EC-03, EC-20, BO-5. Design: the architecture reference (device-owned database plus a sync hub).

**Depends on**: 001 and the other counter features (sync carries their records), 005 (approvals, audit), 007 (rack counts on the godown app). This feature adds the server.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sync that never loses or duplicates a bill (Priority: P1)

Devices work offline and exchange immutable operations with the server when connected. Changes sync within a minute of reconnecting. Two counters that change the same stock keep both changes. No bill is lost or duplicated.

**Why this priority**: Zero lost or duplicated bills is the top risk in the PRD register, and every phone feature depends on sync.

**Independent Test**: Take two devices offline, bill on both including the last unit of one item, reconnect, and verify one copy of each bill and stock −1 flagged.

**Acceptance Scenarios**:

1. **Given** a device offline for 7 days, **When** it reconnects, **Then** all its bills and movements sync within a minute without duplicates.
2. **Given** two offline counters sell the last unit, **Then** both sales sync and stock goes to −1 flagged (EC-02).
3. **Given** the connection drops mid-sync, **Then** a retry sends no duplicate (idempotent operations).
4. **Given** the sync indicator, **Then** it shows the number of pending changes and turns amber when behind (EC-01).
5. **Given** a device with a wrong clock, **Then** server time is recorded alongside device time and the owner is alerted if the gap exceeds 10 minutes (EC-20).

---

### User Story 2 - Owner Today card (Priority: P1)

The owner opens the phone app and sees sales, expected cash in the drawer, UPI pending, credit given, collected and overdue khata, compared with the same day last week, with "updated x minutes ago". Every figure drills down to the documents behind it.

**Why this priority**: Owner control when away (BO-5: opened 6 of 7 days) is a headline goal.

**Independent Test**: Make bills and a pending UPI; open the card and tap Sales to see and open each bill.

**Acceptance Scenarios**:

1. **Given** the app opens, **Then** the card shows within 3 seconds on a phone connection.
2. **Given** a figure is tapped, **Then** the documents behind it list and each opens (in 3 taps or fewer from any report, NFR-015).
3. **Given** weak signal, **Then** the app works and shows data freshness.

---

### User Story 3 - Ranked alerts and remote approvals (Priority: P1)

Alerts are ranked by money at stake: pending approvals, cash difference, below-cost or cancelled bills, overdue parties, low stock (V2), claims expiring (V3) and licence meter (V2). The owner approves or rejects requests with a reason; a phone notification arrives within 10 seconds when online.

**Why this priority**: Remote approval keeps the counter moving without the owner on site.

**Independent Test**: Request a below-cost approval at the counter and approve it from the phone in under 2 minutes.

**Acceptance Scenarios**:

1. **Given** an approval request, **Then** a notification arrives within 10 seconds when online and the owner can approve or reject with a reason.
2. **Given** no response in 2 minutes, **Then** the request expires and the action stays unsaved.
3. **Given** several alerts, **Then** they are ranked by money at stake.

---

### User Story 4 - Godown phone app (Priority: P2)

The helper uses a scan-first phone app to receive goods, find and move stock, and count racks one at a time.

**Why this priority**: Stock accuracy depends on easy counting by the helper.

**Independent Test**: Count rack R3 on the phone and see it reflected at the counter after sync.

**Acceptance Scenarios**:

1. **Given** the phone camera, **Then** items scan by barcode.
2. **Given** a rack count saved, **Then** it syncs to the counter and the rack shows done.

---

### User Story 5 - Backup, device control and recovery (Priority: P1)

Encrypted cloud backup runs every 15 minutes when online, plus a daily copy to a second drive or USB. A lost computer is replaced and restored in 30 minutes or less. The owner can remotely log out a lost device, and unsynced bills on it are reported as "at risk" with last sync time.

**Why this priority**: The single-point-of-failure protection promised in the PRD.

**Independent Test**: Delete a computer's data, restore on a new one from the backup using the written guide, and verify bills and stock.

**Acceptance Scenarios**:

1. **Given** online, **Then** a backup runs every 15 minutes and is encrypted.
2. **Given** a restore on a clean machine, **Then** the shop is running within 30 minutes by someone other than the builder.
3. **Given** a lost device, **Then** the owner revokes it and unsynced bills are listed as "at risk" with last sync time (EC-03).

---

### Edge Cases

- Owner phone offline during an approval: the request waits to expire; counter PIN approval still works.
- Two owners' phones logged in: both receive requests; the first decision wins.
- Schema version mismatch between a device and the server: the device updates before syncing.
- Server down for days: counters keep billing; the sync queue holds operations.
- A revoked device comes back online: refused and its pending bills flagged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Today card MUST show sales, expected cash, UPI pending, credit given, collected and overdue khata compared with the same day last week (FR-OWN-001).
- **FR-002**: Every figure MUST drill down to its documents (FR-OWN-002).
- **FR-003**: Alerts MUST be ranked by money at stake (FR-OWN-003).
- **FR-004**: Approve or reject MUST work with a reason, notifying within 10 seconds when online (FR-OWN-004).
- **FR-005**: App MUST work on weak signal and show how fresh the data is (FR-OWN-005).
- **FR-006**: Counter functions MUST work for at least 7 days offline, syncing within a minute of reconnecting, with zero lost or duplicated bills and both stock changes kept (NFR-004, NFR-005).
- **FR-007**: System MUST keep an encrypted cloud backup every 15 minutes when online and a daily second-drive copy, with 30-minute restore (NFR-006).
- **FR-008**: System MUST protect data in storage and transit, keep PINs unreadable, and let the owner remotely log out a lost device (NFR-008).
- **FR-009**: Server time MUST be recorded with device time and gaps over 10 minutes alerted (EC-20).
- **FR-010**: Online services MUST be available at least 99.5% of each month, and the counter MUST never depend on them to bill (NFR-007).
- **FR-011**: A breach response plan MUST exist (inform affected people and the Board, detailed report within 72 hours) (NFR-009).
- **FR-012**: Godown app MUST support scan-first receiving, finding, moving and counting (section 3 persona).
- **FR-013**: Sync MUST use idempotent operations with per-device ordering and retries without duplication.

### Key Entities

- **Device**: Registered device, role, last sync, revoked flag.
- **Sync Operation**: Immutable operation with id, device, sequence and payload.
- **Sync Cursor / Conflict Record**: Position per device and recorded conflicts.
- **Push Subscription**: Phone token for notifications.
- **Today Snapshot**: Derived summary figures with freshness time.
- **Alert**: Ranked item with money at stake and source link.
- **Backup Set**: Encrypted backup with time and restore status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero lost or duplicated bills across a 7-day offline test with 2 counters and a phone.
- **SC-002**: The Today card opens within 3 seconds and approvals reach the phone within 10 seconds when online.
- **SC-003**: The owner opens the Today card on 6 of 7 days.
- **SC-004**: Days with unsynced data older than 24 hours: 0.
- **SC-005**: A lost computer is restored in 30 minutes or less by someone other than the builder.

## Assumptions

- The server uses the architecture reference's design (device-owned database and a sync hub); its stack is fixed in that plan, not in this spec.
- The owner phone app is Android; push notifications use the platform's standard service.
- WhatsApp sharing remains link-based; no messaging API is needed for this feature.
- Detailed sync conflict rules per record type (additive operations first, explicit rules for the rest) are set in the plan from the architecture reference.
- Running cost stays low; hosting choice is made in the plan.
