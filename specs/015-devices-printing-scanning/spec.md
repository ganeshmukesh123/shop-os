# Feature Specification: Devices, Printing and Scanning

**Feature Branch**: `015-devices-printing-scanning`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Make Shop OS work with the shop's real hardware: Mac, Windows and Linux computers and Android phones and tablets; thermal receipt printers and A4/A5 printing; USB barcode scanners and phone-camera scanning; barcode label printing; backup power and a second device that can bill."

**PRD source**: `docs/reference/PRD.md` NFR-013, FR-BIL-015, FR-ITM-013, FR-DLV-005, FR-STK-011 (roll labels), section 15 (hardware dependency, risk "hardware failure at counter", fallback), EC-04.

**Depends on**: 001 (basic printing). Camera scanning for phones depends on 010. Label and roll labels support 002 and 007.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Print bills on the shop's printer (Priority: P1)

Staff print a bill on a thermal receipt printer or on A4/A5. A printer failure never blocks saving; staff can retry, share on WhatsApp or reprint later.

**Why this priority**: Printing at the counter is part of every sale, and printers are the commonest hardware fault.

**Independent Test**: Print a 5-line bill on the shop's receipt printer and on A4; unplug the printer, save a bill, then reprint after reconnecting.

**Acceptance Scenarios**:

1. **Given** a receipt printer of the shop's model, **Then** the bill prints at the right width with readable text and cuts or feeds correctly.
2. **Given** A4 or A5, **Then** the bill prints with the same content in the larger layout.
3. **Given** the printer is out of paper or offline, **Then** the bill saves, a prompt offers retry, WhatsApp share or reprint later from bill history (EC-04).
4. **Given** a printer without raw receipt-command support, **Then** printing goes through the operating system driver as a fallback.
5. **Given** Devanagari text, **Then** it prints correctly or the user is told the printer cannot and the bill falls back to a safe format.

---

### User Story 2 - Scan items with a barcode scanner or the phone camera (Priority: P1)

A USB barcode scanner works as a keyboard at the counter; on phones and tablets the camera scans barcodes. A scanned item adds to the bill or opens the right screen. A barcode on two items opens a chooser and logs a data issue.

**Why this priority**: Scan-first is the helper's way of working and speeds counter billing.

**Independent Test**: Scan 10 items with a USB scanner at the counter and with the phone camera in the godown app.

**Acceptance Scenarios**:

1. **Given** a USB scanner, **Then** a scan adds the item to the bill without clicking a field first.
2. **Given** the phone camera, **Then** barcodes scan in normal shop light and add or find the item.
3. **Given** the same barcode on two items, **Then** a chooser opens and a data issue is logged (EC-07).
4. **Given** an unknown barcode, **Then** the user can search, create an item or record it as unmet demand.

---

### User Story 3 - Print barcode labels and shelf tags (Priority: P2)

Items without manufacturer barcodes get barcode labels printed, and racks and shelves get location tags. Roll labels (length and roll ID) print for cut-length items.

**Why this priority**: Own-barcode labels make scanning possible for loose items and racks.

**Independent Test**: Print labels for 10 items and 3 rack tags and scan the printed labels back.

**Acceptance Scenarios**:

1. **Given** items without barcodes, **Then** labels print with a scannable barcode and item name.
2. **Given** a rack or shelf, **Then** a location tag prints and scans to that location.
3. **Given** a roll, **Then** a label with roll ID and labelled length prints (V2).

---

### User Story 4 - Runs on the shop's computers, tablets and phones (Priority: P1)

The counter app runs on Mac (first use), Windows and Linux computers and on an Android tablet; the owner and godown apps run on Android phones. A second device can take over billing if the main one fails.

**Why this priority**: Hardware failure at the counter is a listed risk; a second device is the stated mitigation.

**Independent Test**: Install on a Mac and a Windows PC; restore the shop's data on the second device and bill within 30 minutes.

**Acceptance Scenarios**:

1. **Given** a supported computer, **Then** the counter app installs, opens and bills on Mac, Windows and Linux.
2. **Given** an Android tablet or phone, **Then** the matching app installs and works at its screen size with large tap targets.
3. **Given** the main counter device fails, **Then** a second device can bill offline after restoring a backup or syncing.
4. **Given** a power cut, **Then** a bill being saved is not corrupted (backup power is the shop's responsibility).

---

### User Story 5 - Hardware readiness check (Priority: P3)

A device health check lists the connected printer, scanner and camera status, last backup time and free disk space, and warns of problems.

**Why this priority**: Early warning for hardware faults named in the risk table.

**Independent Test**: Disconnect the printer and see the check report it.

**Acceptance Scenarios**:

1. **Given** the health check, **Then** it shows printer reachable, scanner detected, free space and last backup.
2. **Given** a problem, **Then** it shows a plain next step.

---

### Edge Cases

- Two printers (receipt and A4): the user chooses a default per bill type.
- Scanner sends extra characters: the app strips trailing control characters.
- Low light in the godown: camera scanning offers a torch toggle.
- Printer paper width 58 mm vs 80 mm: layout follows the shop setting.
- Barcode with leading zeros or check digit variants: matched consistently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST run on Mac, Windows and Linux computers (first use on Mac) and on Android phones and tablets (NFR-013).
- **FR-002**: System MUST print to thermal receipt printers and to A4/A5, and a printer failure MUST NOT block saving a bill (FR-BIL-015, EC-04).
- **FR-003**: System MUST fall back to printing through the operating system driver when a printer does not support raw receipt commands.
- **FR-004**: System MUST support USB barcode scanners and phone-camera scanning (NFR-013).
- **FR-005**: System MUST handle one barcode on two items with a chooser and a logged data issue (EC-07).
- **FR-006**: System MUST print barcode labels and shelf location tags for items without manufacturer barcodes (FR-ITM-013) and roll labels when rolls exist (FR-STK-011).
- **FR-007**: A second device MUST be able to take over billing after a restore or sync.
- **FR-008**: System SHOULD provide a hardware health check for printer, scanner, camera, disk space and last backup.
- **FR-009**: UI MUST use large tap targets suitable for tablets and phones (NFR-011).
- **FR-010**: Printer and scanner models in use MUST be recorded in the shop's settings for support.

### Key Entities

- **Device**: Computer, tablet or phone with platform and role.
- **Printer Profile**: Type, paper width, connection, default for bill type.
- **Scanner Profile**: USB or camera and settings.
- **Label Template**: Barcode label, shelf tag, roll label layouts.
- **Health Check Result**: Time, component states and messages.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A bill prints on the shop's receipt printer in under 3 seconds after save in 20 of 20 trials.
- **SC-002**: A printer failure results in zero lost bills across 20 deliberate failures.
- **SC-003**: A scanned item adds to a bill in under 1 second with a USB scanner.
- **SC-004**: Camera scanning reads 95% of barcodes in 50 trials in normal shop light.
- **SC-005**: A second device is billing within 30 minutes of the main device failing, in a drill.

## Assumptions

- The shop's actual printer model, paper width and scanner are not yet confirmed; the first printing test is a spike in 001 (task T008) and its result decides the details here.
- Raw receipt-command printing is deferred; the operating system print dialog is the first path (feature 001 research).
- Backup power and spare printer are the shop's purchases (PRD dependency table).
- Label printing uses the same printers or a separate label printer; the choice depends on what the shop owns.
