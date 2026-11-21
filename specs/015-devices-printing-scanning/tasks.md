---
description: "Task list for feature 015: printer profiles, scanning, location tags, platforms, health check"
---

# Tasks: Devices, Printing and Scanning

**Input**: Design documents from `/specs/015-devices-printing-scanning/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, quickstart.md. 001 T008 (printer spike) done; 002, 007, 010 and 014 merged.

**Tests**: Included for every rule and for "printing never affects a saved bill" (constitution I).

**Organization**: US1, US2, US4 (P1), US3 (P2), US5 (P3). The proposed deferral of the Android tablet counter (FR-001, US4 scenario 2) is pending owner decision OD-1; roll labels wait for 007's V2 rolls.

## Format: `[ID] [P?] [Story] Description`

`core` = `packages/core`, `desktop` = `apps/desktop`.

---

## Phase 1: Setup

- [ ] T001 Ask the owner OD-1 and OI-2, OI-4; record the printer spike result (OI-1) in `specs/015-devices-printing-scanning/research.md`
- [ ] T002 [P] Create `core/src/devices/` with a barrel exported from `core/src/index.ts`

---

## Phase 2: Foundational

- [ ] T003 [P] Write tests in `core/tests/devices/scannerBurst.test.ts`: 13 characters 8 ms apart ending with Enter is a scan; the same typed 120 ms apart is not; a burst shorter than the minimum is not
- [ ] T004 [P] Write tests in `core/tests/devices/barcodeNormalise.test.ts` and `ean13.test.ts`: control characters and configured prefix and suffix removed; UPC-A `036000291452` becomes EAN-13 `0036000291452`; check digit validation; a wrong check digit still returns the typed code
- [ ] T005 [P] Write tests in `core/tests/devices/locationTag.test.ts` and `healthChecks.test.ts`: `LOC-R3` parses to short code `R3`; missing printer, low disk (under 2 GB), backup older than 26 hours and no sync for 24 hours each give a problem with a next step
- [ ] T006 Implement `core/src/devices/*.ts` to pass T003 to T005
- [ ] T007 Add `printer_profile`, `scanner_profile`, `print_log` (append-only) and `location.short_code` to `desktop/src/main/db/schema.ts`; migrate `shop_profile.receipt_width` into a default receipt profile; generate the migration (marked additive). Backfill existing location codes and allocate codes on new location inserts per [the data model](./data-model.md#changed-tables).

---

## Phase 3: User Story 1 - Print bills on the shop's printer (M1, 13 to 19 Sep 2027; P1) MVP

- [ ] T008 [P] [US1] Write tests in `desktop/src/main/services/printing/PrintService.test.ts` with the fake renderer: silent print to the profile's `deviceName` and assert driver `pageSize` width plus rendered receipt body width for both profiles (58 mm: 58,000 µm and 54 mm body; 80 mm: 80,000 µm and 76 mm body with 2 mm margins on each side). Use a conflicting shop width to catch fallback; A4 and A5 layouts; every attempt written to `print_log`; a failing or cancelled print leaves the bill row and lines byte for byte unchanged; no profile gives `NO_PRINTER_PROFILE`
- [ ] T009 [US1] Extend `desktop/src/main/services/PrintService.ts` (moved to `desktop/src/main/services/printing/`) and `electronRenderer.ts` to derive driver `pageSize` and receipt HTML layout from the same selected profile width and pass T008; add `documents.print` for returns, quotes, challans, receipts and statements
- [ ] T010 [US1] Implement `PrinterProfileService.ts` and `TestPage.ts` (a page with English, Hindi and a barcode) and `printers.*` commands
- [ ] T011 [US1] When a profile cannot print Devanagari, render bills for it with item and party names in their English or code form and show "This printer cannot print Hindi" (014)
- [ ] T012 [P] [US1] Build `desktop/src/renderer/features/devices/Printers/` (OS printers, profiles, defaults per document, test page and result) and change the saved-bill screen to say "Sent to printer" or "Could not send to printer" with Retry, Share on WhatsApp and Reprint
- [ ] T013 [US1] Run quickstart 1 on the real printer and record SC-001 and SC-002 in `specs/015-devices-printing-scanning/plan.md`

---

## Phase 4: User Story 2 - Scan items (M2, 20 to 24 Sep; P1)

- [ ] T014 [US2] Implement `desktop/src/renderer/shared/scanner/useScannerListener.ts` (window-level key listener using `isScannerBurst`, normalisation from the scanner profile, calls 002's `items.lookupBarcode`, reports `scanners.recordScan`) and mount it on the bill, count and move screens
- [ ] T015 [P] [US2] Build `desktop/src/renderer/features/devices/UnknownBarcode/` (Search, Create item with this barcode, Record as unmet demand) and `Scanners/` (profiles)
- [ ] T016 [US2] Write the e2e spec `desktop/tests/e2e/scanning.spec.ts`: simulated bursts add items without focusing a field; a scan in a focused text field leaves its value unchanged; hand-typed text and Enter reach the field unchanged; UPC-A matches stored EAN-13 and EAN-13 matches stored UPC-A; duplicate barcode chooser; unknown barcode panel; a scan while the stock-adjust quantity field has focus does not call `save()`, and a scan in a bill line's quantity does not run `onEnterQty()`; after a scan in the quantity field, the draft line's quantity is what it was before the burst
- [ ] T017 [US2] Measure SC-003 with the real scanner and SC-004 on the phone (010's godown app) and record them

---

## Phase 5: User Story 3 - Labels and tags (M2, 25 to 26 Sep; P2)

- [ ] T018 [US3] Add `kind: "location_tag"` to 002's `LabelService` (Code 128 `LOC-<short_code>`, location path as text) and label printer profiles to `labels.print`; scanning a location tag in the count or move screen opens that location
- [ ] T019 [US3] Run quickstart 3 and record that every printed label and tag scans back

---

## Phase 6: User Story 4 - Runs on the shop's computers (M3, 27 Sep to 1 Oct; P1)

- [ ] T020 [US4] Add NSIS (Windows) and AppImage and deb (Linux) targets to `desktop/electron-builder.yml` and build all three in CI (017's workflow); record the SmartScreen warning until 018's signing (OI-3)
- [ ] T021 [US4] Write `desktop/tests/integration/killDuringSave.test.ts`: kill the process at random points of a bill save 20 times; every bill complete or absent
- [ ] T022 [US4] Write the second-device takeover steps into the restore guide; run the drill on a spare laptop (server restore and offline second-drive restore) and record SC-005 with 012's `gates.record` as a restore drill

---

## Phase 7: User Story 5 - Hardware readiness check (M3, 2 to 3 Oct; P3)

- [ ] T023 [US5] Implement `desktop/src/main/services/hardware/HealthCheckService.ts` (`getPrintersAsync`, profiles, last scan, `fs.statfs` free space, last backup, last sync) and `hardware.health`
- [ ] T024 [P] [US5] Build `desktop/src/renderer/features/devices/HealthCheck/` (levels as words, next steps) and show problems on the owner's home screen
- [ ] T025 [US5] Run quickstart 5

---

## Phase 8: Polish

- [ ] T026 [P] Check new screens in System, Light and Dark (quickstart 6)
- [ ] T027 [P] Add new screen text to the text catalogue (014)
- [ ] T028 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`

---

## Dependencies and execution order

```
Setup --> Foundational --> US1 --> US2 --> US3 --> US4 --> US5 --> Polish
```

US3 reuses US2's scanning for the scan-back check; US4 and US5 are independent of US2 after the foundation.

## Parallel examples

- Phase 2: T003, T004, T005 together.

## Implementation strategy

Printing first (every sale), then scanning (speed), then platforms and the drill (resilience), the health check last.
