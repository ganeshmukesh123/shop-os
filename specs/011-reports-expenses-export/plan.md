# Implementation Plan: Reports, Expenses, Real Profit and CA Export

**Branch**: `011-reports-expenses-export` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-reports-expenses-export/spec.md`, PRD section 10 Reports, FR-CMP-004, FR-CMP-014, NFR-015, the architecture reference sections 7.8, 8.2 and 11.10, the constitution v2.1.0, feature 018 (work off the main process), and the data of 002 to 009.

**Scope of this plan**: US1 (MVP, built early as M0 before go-live), US2, US3 and the distributor scorecard of US4 (V2). The contractor ranking (FR-007) and US5 (FR-008 to 010) are V3 and not planned (research "Scope and timing").

## Summary

One report engine: definitions in `@shopos/core`, SQL queries in an Electron utility process over a read-only connection, a single Radix table screen with totals, filters, CSV and Excel export, and drill-down from any figure to its documents in 3 taps. Core reports (sales by seven dimensions, exceptions, stock value at cost) ship before go-live. Then expenses and owner drawings (append-only, cash ones in the drawer), real profit from each line's cost at sale with a cost-completeness figure and honest "not tracked yet" terms, CA exports for composition (CMP-08, GSTR-4, purchases register, Tally) and regular (GSTR-1, GSTR-3B) with a 7-day reminder calendar, and a distributor scorecard.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Unchanged; XLSX writing uses 002's approved parser package if accepted (002 OD-2), otherwise CSV only. No chart library (research D10).

**Storage**: Same SQLite file. New `expense_category`, `expense`, `owner_drawing`, `compliance_calendar`, `export_job`; four report indexes; `cash_entry.kind` value `owner_drawing`.

**Testing**: Vitest test-first for every figure (sales, cost completeness, real profit, stock value, CA turnover) with a fixed data set and hand-checked answers; a 20-report reconciliation script (SC-002); a 500-bill-day timing test (SC-001); Playwright for the quickstart.

**Target Platform**: macOS first; Windows and Linux.

**Project Type**: desktop-app (pnpm workspace).

**Performance Goals**: Daily sales report under 3 s for 500 bills (SC-001); a month report under 5 s; the counter's bill save unaffected while a report runs (NFR-002); CA quarter export under 2 minutes (SC-003).

**Constraints**: Offline; reports never change data; current bill versions only; numbers trace to documents (NFR-015).

**Scale/Scope**: 10 years of data at 500 bills a day (NFR-014); about 13 report definitions; 6 screens (report runner, expenses, profit, CA export, calendar, scorecard).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle              | How this plan satisfies it                                                                | Status          |
| ---------------------- | ----------------------------------------------------------------------------------------- | --------------- |
| I. Saved bill versions | Read-only; current versions only                                                          | Pass            |
| II. Traceable numbers  | Every cell carries its drill filter; reconciliation test equals source documents (SC-002) | Pass            |
| III. Integers          | All sums in paise and thousandths; rupee formatting only in export cells                  | Pass            |
| IV. Offline-first      | Local queries; the server's projections (010) are not needed                              | Pass            |
| V. UI-free core        | Definitions and figure rules in core                                                      | Pass            |
| VI. Test-first         | Figures tested first; expenses (cash entries) tested first                                | Pass            |
| VII. Simplicity        | One engine; no chart library; V3 reports out                                              | Pass            |
| VIII to X              | Units in column definitions; "Cost unknown" and "Not tracked yet" as words; both themes   | Pass            |
| Compliance is data     | CA formats and due dates are settings and open items (OI-1 to OI-3)                       | Pass (recorded) |

Post-design re-check (2026-11-18): no violations.

## Project Structure

### Documentation (this feature)

```text
specs/011-reports-expenses-export/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
└── contracts/ipc-commands.md
```

### Source Code (repository root)

```text
packages/core/src/reports/     # definitions/ (one file per report), salesFigures.ts, costCompleteness.ts, realProfit.ts,
                               # stockValue.ts, exceptionRows.ts, caTurnover.ts, rowLimit.ts, scorecard.ts
apps/desktop/src/main/
├── reports/                   # reportWorker (utilityProcess entry), queries/ (one per definition), ExportService
├── services/expenses/         # ExpenseService (expenses, drawings, cash entries)
├── services/caExport/         # Cmp08Export, Gstr4Export, PurchasesRegister, TallyExport, Gstr1Export, Gstr3bExport
├── services/calendar/         # ComplianceCalendarService
└── ipc/handlers.ts
apps/desktop/src/renderer/features/reports/
├── ReportRunner/ (Filters/, ResultTable/, DrillList/), Expenses/, RealProfit/, CaExport/, ComplianceCalendar/, Scorecard/
```

**Structure Decision**: Same two packages; the report worker is a separate `utilityProcess` entry so heavy queries never block the main process (018).

## Milestone Plan

| #   | Dates                                    | Milestone                                                | Exit criteria                                                     |
| --- | ---------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| M0  | 13 to 26 Sep 2027 (before go-live; OD-1) | Report engine and core reports (US1)                     | Quickstart 0; SC-001 and SC-002; OI-4 checked                     |
| M1  | 17 to 23 Jan 2028                        | Expenses and real profit (US2)                           | Quickstart 1; SC-005                                              |
| M2  | 24 to 30 Jan                             | CA export for composition (US3 scenarios 1 to 3)         | OI-1 and OI-3 answered; the CA accepts a quarter's files (SC-003) |
| M3  | 31 Jan to 6 Feb                          | Regular-scheme exports, calendar (US3 scenarios 4 and 5) | Quickstart 2; OI-2 answered                                       |
| M4  | 7 to 13 Feb                              | Distributor scorecard (US4 FR-006)                       | Quickstart 3 and 4; SC-004 monthly leakage view                   |

**Risks and fallbacks**

- A report is slow on 10 years of data: add a projection for that report only (research D2), tested against the documents.
- The CA's Tally version cannot import our XML: export the CA's spreadsheet layout instead (OI-1).

## Complexity Tracking

| Addition                            | Why it is needed                                   | Simpler alternative rejected because                       |
| ----------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Report worker in a `utilityProcess` | Long queries must not stall billing (018, NFR-002) | Running queries in the main process blocks IPC for seconds |
| Report definitions as data          | 13 reports with one screen and one export path     | One screen per report multiplies code and drill-down bugs  |
