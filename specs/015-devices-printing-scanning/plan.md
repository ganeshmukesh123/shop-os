# Implementation Plan: Devices, Printing and Scanning

**Branch**: `015-devices-printing-scanning` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-devices-printing-scanning/spec.md`, PRD NFR-011, NFR-013 and the hardware rows of section 15, the architecture reference sections 3 and 12.1, 001 research D9 and D24, the current `PrintService.ts`, and the designs of 002, 007, 010, 012, 014 and 018.

## Summary

Make the shop's hardware dependable without making it a dependency of the sale. Bills keep printing through the OS driver from HTML, now silently to a chosen printer profile with the right paper width and per-document defaults; every attempt is logged and "sent to printer" is never confused with "printed", so reprint and WhatsApp share are always one tap away. USB scanners work anywhere on the bill screen by keystroke timing, with barcode normalisation and an unknown-barcode panel; phone camera scanning is in 010's apps. Location tags join 002's item labels. Installers for macOS, Windows and Linux, a timed second-device takeover drill, and a health check with plain next steps complete it. The Android tablet counter is proposed for a separate spec (OD-1, pending owner decision).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Unchanged (Electron printing APIs, electron-builder targets); no new package. Raw ESC/POS stays deferred (research D1).

**Storage**: Same SQLite file. New `printer_profile`, `scanner_profile`, `print_log`; `location.short_code`; `shop_profile.receipt_width` migrated into the default receipt profile.

**Testing**: Vitest for scanner burst detection, barcode normalisation, location tags and health checks; integration tests for the print path with the fake renderer; manual hardware runs recorded against SC-001 to SC-005; a kill-during-save loop.

**Target Platform**: macOS, Windows, Linux desktops; Android phones (010).

**Project Type**: desktop-app (pnpm workspace).

**Performance Goals**: Paper out within 3 s of save (SC-001); scan to line under 1 s (SC-003).

**Constraints**: Printing never blocks or affects a saved bill; no native printing module; printed output always light.

**Scale/Scope**: 1 to 3 printers, 1 to 2 scanners per shop; 4 screens (printers, scanners, unknown-barcode panel, health check).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle                        | How this plan satisfies it                                                                   | Status                     |
| -------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------- |
| I. Saved bill versions           | Print starts only after commit; print results never touch the bill (SC-002)                  | Pass                       |
| IV. Offline-first                | Printing and USB scanning need no network; takeover works from the second-drive copy offline | Pass                       |
| V. UI-free core                  | Burst detection, normalisation, tag parsing and health rules in core                         | Pass                       |
| VII. Simplicity                  | No ESC/POS or native modules; tablet counter deferred to its own spec (OD-1)                 | Pass                       |
| X. Design                        | Printed output light; health levels with words; large tap targets                            | Pass                       |
| Unconfirmed facts                | Printer behaviour (OI-1) recorded, not assumed                                               | Pass (recorded)            |
| Performance target (constraints) | Bill save and print about 1 s; the 3 s print target is measured on the real printer          | Pass once OI-1 is measured |

Post-design re-check (2026-11-18): FR-001 remains unmet. It requires Android phone and tablet support; this plan covers phones via 010 and proposes deferring the US4 tablet counter under [OD-1](./research.md#owner-decisions-needed). Keep this gap open until the plan covers the tablet counter or the owner approves the deferral and FR-001 or the feature scope is updated.

## Project Structure

### Documentation (this feature)

```text
specs/015-devices-printing-scanning/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
└── contracts/ipc-commands.md
```

### Source Code (repository root)

```text
packages/core/src/devices/   # scannerBurst.ts, barcodeNormalise.ts, ean13.ts, locationTag.ts, healthChecks.ts
apps/desktop/src/main/
├── services/printing/       # PrinterProfileService, PrintService (silent, deviceName, pageSize, log), TestPage
├── services/hardware/       # HealthCheckService
└── ipc/handlers.ts
apps/desktop/src/renderer/
├── shared/scanner/          # useScannerListener (burst detection, routes to lookup)
└── features/devices/        # Printers/, Scanners/, UnknownBarcode/, HealthCheck/
apps/desktop/electron-builder.yml  # dmg, nsis, AppImage, deb targets
```

**Structure Decision**: Same two packages; the scanner listener is shared renderer code used by the bill, count and move screens.

**Receipt width**: Use the selected printer profile's `paper_width_mm` for both driver `pageSize` and HTML layout. The body fits within that width after page margins. The shop width seeds the default profile during migration (T007), then the selected profile controls each print ([spec edge case](./spec.md#edge-cases)). T008 tests both outputs at 58 mm and 80 mm.

## Milestone Plan

Window 13 September to 3 October 2027 (proposed, 002 research D16; two weeks later if 011's OD-1 is accepted).

| #   | Dates           | Milestone                                                                  | Exit criteria                                           |
| --- | --------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| M1  | 13 to 19 Sep    | Printer profiles, silent printing, print log, Devanagari test (US1)        | Quickstart 1; OI-1 answered; SC-001 and SC-002 measured |
| M2  | 20 to 26 Sep    | Scanner listener, normalisation, unknown barcode, location tags (US2, US3) | Quickstart 2 and 3; OI-2 and OI-4 answered              |
| M3  | 27 Sep to 3 Oct | Installers on three OSes, takeover drill, health check (US4, US5)          | Quickstart 4, 5 and 6; SC-005 drill                     |

**Risks and fallbacks**

- The driver path is too slow or cannot cut paper: ESC/POS task with a package chosen with the owner (research D1 "Revisit when").
- No Linux driver for the shop's printer: the Linux build is supported for billing and PDF only; the counter stays on macOS or Windows.

## Complexity Tracking

| Addition                              | Why it is needed                                                     | Simpler alternative rejected because                     |
| ------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| Printer profiles with silent printing | No print dialog on every counter bill; two printers (spec edge case) | The OS dialog on each bill slows the counter past SC-001 |
| Timing-based scanner detection        | Scan without clicking a field (US2 scenario 1)                       | A focused input field breaks when focus is elsewhere     |
