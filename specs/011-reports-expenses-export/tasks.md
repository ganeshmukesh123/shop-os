---
description: "Task list for feature 011: report engine, core reports, expenses, real profit, CA export, scorecard"
---

# Tasks: Reports, Expenses, Real Profit and CA Export

**Input**: Design documents from `/specs/011-reports-expenses-export/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, quickstart.md. M0 needs 002 to 008; M1 onward needs 009.

**Tests**: Included and written first for every figure (constitution II: numbers trace to documents) and for expenses (they write cash entries).

**Organization**: US1 (MVP, as M0 before go-live), US2 and US3 (V2), US4's distributor scorecard (V2). FR-007 to FR-010 (V3) are **not planned**.

## Format: `[ID] [P?] [Story] Description`

`core` = `packages/core`, `desktop` = `apps/desktop`.

---

## Phase 1: Setup

- [ ] T001 Ask the owner OD-1 (core reports before go-live) and check OI-4 (does 003 store `cost_paise` on every bill line); record in `specs/011-reports-expenses-export/research.md`
- [ ] T002 [P] Create `core/src/reports/` with `definitions/` and an `index.ts` barrel exported from `core/src/index.ts`
- [ ] T003 Add a `utilityProcess` entry `desktop/src/main/reports/reportWorker.ts` to the electron-vite build config with a read-only database connection, and a request and response channel with paging

---

## Phase 2: Foundational

- [ ] T004 [P] Write tests in `core/tests/reports/salesFigures.test.ts` with a fixed data set: cancelled bills excluded; an edited bill counted once at its current version; returns booked in the return's period; gross, discounts, returns and net equal hand-checked values
- [ ] T005 [P] Write tests in `core/tests/reports/stockValue.test.ts`, `exceptionRows.test.ts`, `rowLimit.test.ts`: stock value = quantity x cost per item and location with "Cost unknown" items flagged; exception rows for each kind; 2,500,000 rows split into 3 parts at 1,048,576
- [ ] T006 Implement `core/src/reports/salesFigures.ts`, `stockValue.ts`, `exceptionRows.ts`, `rowLimit.ts` and the `IReportDefinition` type to pass T004 and T005
- [ ] T007 Add the report indexes of `data-model.md` (`bill_line(variant_id)`, `bill(user_id, business_date)`, `bill_tender(mode)`, `sales_return(business_date)`) and `export_job` to `desktop/src/main/db/schema.ts`; generate the migration; seed `report.view`, `report.profit` and `data.export` with the defaults referenced in the IPC contract, inserting only missing grants so existing feature 005 grants and owner edits are preserved

---

## Phase 3: User Story 1 - Core reports with export (M0, 13 to 26 Sep 2027; P1) MVP

- [ ] T008 [P] [US1] Write the reconciliation test `desktop/tests/integration/reportReconciliation.test.ts`: 20 report totals equal sums over the source documents for a scripted month (SC-002)
- [ ] T009 [P] [US1] Write the timing test `desktop/tests/integration/reportTiming.test.ts`: a day of 500 bills, each sales report under 3 s (SC-001), with a bill save running at the same time staying under 1 s
- [ ] T010 [US1] Write definitions `sales_by_day`, `sales_by_item`, `sales_by_category`, `sales_by_brand`, `sales_by_staff`, `sales_by_customer`, `sales_by_payment_mode`, `exceptions`, `stock_value_by_location`, `stock_value_by_category` in `core/src/reports/definitions/` and their queries in `desktop/src/main/reports/queries/` to pass T008 and T009
- [ ] T011 [US1] Implement `reports.list`, `reports.run`, `reports.drill` through the worker with main-process permission checks: require `report.view` and require `report.profit` before exposing margin or profit data through listing, running or drilling
- [ ] T012 [US1] Implement `desktop/src/main/reports/ExportService.ts` (`reports.export`: CSV always, XLSX if 002's package is approved, row-limit split, rupee and paise columns, audited as `data.export`); enforce `data.export` in the IPC handler before file writes and require `report.profit` for margin or profit data. Test that a Counter session with report viewing granted and default export permissions gets `PERMISSION_DENIED` and no file is written
- [ ] T013 [P] [US1] Build `desktop/src/renderer/features/reports/ReportRunner/` with `Filters/`, `ResultTable/` (Radix Table, totals row, "Cost unknown" as a word) and `DrillList/` (documents; opening one shows the bill view)
- [ ] T014 [US1] Write the e2e spec `desktop/tests/e2e/coreReports.spec.ts` for quickstart 0, including the 3-tap drill check (FR-013)

---

## Phase 4: User Story 2 - Expenses and real profit (M1, 17 to 23 Jan 2028; P1, V2)

- [ ] T015 [P] [US2] Write tests in `core/tests/reports/costCompleteness.test.ts` and `realProfit.test.ts`: sales ₹4,52,000, returns ₹12,000, cost ₹3,41,000, expenses ₹38,500 give ₹60,500; absent terms marked not tracked; completeness by value in basis points (a costed product with an uncosted delivery charge is 10,000 bp, or 100% complete); a restocked return reverses only the returned quantity at the original sale cost; drawings not in expenses Completeness is `null` with no goods sold and with only service lines; 2 of 5 pcs returned from a ₹300 line reverses ₹120, and two returns never reverse more than ₹300; a restocked return with no line cost leaves COGS unchanged, counts in `unknownReturnCostCount` and sets `isComplete` false.
- [ ] T016 [P] [US2] Write tests in `desktop/src/main/services/expenses/ExpenseService.test.ts`: cash expense writes the expense and a `cash_expense` entry in one transaction; no open session gives `NO_OPEN_SESSION`; correction is a negative row with a reason, once; drawings write `owner_drawing` cash entries; retrying the same `clientExpenseId` after reopening the database returns the original expense and linked cash entry with no duplicate rows
- [ ] T017 [US2] Implement `core/src/reports/costCompleteness.ts`, `realProfit.ts` and `ExpenseService.ts`; add `expense_category`, `expense` with its unique client key, and `owner_drawing` to the schema. Run the T015 and T016 tests after generating the migration in T035
- [ ] T035 [US2] Generate the T017 migration for `expense_category`, `expense` (including its unique key) and `owner_drawing`; seed the categories and add the `owner_drawing` row to `cash_entry_kind` without rebuilding `cash_entry`
- [ ] T036 [US2] After T017 and T035, register `expenses.*` and `drawings.*` IPC handlers backed by `ExpenseService` per the IPC contract, before T019
- [ ] T018 [US2] Add definitions `real_profit` and `expenses_by_category` and the `profit.real` command with `report.view` and `report.profit` checks
- [ ] T019 [P] [US2] Build `desktop/src/renderer/features/reports/Expenses/` (add, correct, list by category) and `RealProfit/` (formula lines with "Not tracked yet", cost completeness)
- [ ] T020 [US2] Write the e2e spec `desktop/tests/e2e/expensesProfit.spec.ts` for quickstart 1

---

## Phase 5: User Story 3 - CA export (M2 and M3, 24 Jan to 6 Feb 2028; P1, V2)

- [ ] T021 [US3] Send the CA OI-1 to OI-3 and record the Tally version, layouts and due dates in `specs/011-reports-expenses-export/research.md`
- [ ] T022 [P] [US3] Write tests in `core/tests/reports/caTurnover.test.ts`: a quarter's turnover equals 008's `turnoverForYear` over the same days; bills across a scheme switch labelled by format
- [ ] T023 [P] [US3] Write tests in `desktop/src/main/services/caExport/*.test.ts`: CMP-08 file totals; GSTR-4 annual totals; purchases register from 009 with GST per line; GSTR-1 B2B grouped by GSTIN, B2C by rate, HSN summary, credit notes; GSTR-3B by rate; Tally XML validates against the format agreed in T021
- [ ] T024 [US3] Implement `core/src/reports/caTurnover.ts` and `desktop/src/main/services/caExport/` (six exporters) to pass T022 and T023; register `caExport.*`
- [ ] T025 [US3] Implement `desktop/src/main/services/calendar/ComplianceCalendarService.ts` (generate the year's items from settings, reminders 7 days before) with `compliance_calendar` in the schema and tests; register `calendar.*`
- [ ] T037 [US3] Generate the T025 migration for `compliance_calendar` before running its integration tests or starting T026
- [ ] T026 [P] [US3] Build `desktop/src/renderer/features/reports/CaExport/` and `ComplianceCalendar/` (home-screen reminder)
- [ ] T027 [US3] Write the e2e spec `desktop/tests/e2e/caExport.spec.ts` for quickstart 2; the CA checks one real quarter (SC-003)

---

## Phase 6: User Story 4 - Distributor scorecard (M4, 7 to 13 Feb 2028; P2, V2)

- [ ] T028 [P] [US4] Write tests in `core/tests/reports/scorecard.test.ts`: price trend over 3 and 12 months, delay proxy, short-supply rate; roll variance and claim time "not tracked yet"
- [ ] T029 [US4] Implement `core/src/reports/scorecard.ts`, the `distributor_scorecard` definition and `scorecard.distributors` to pass T028
- [ ] T030 [P] [US4] Build `desktop/src/renderer/features/reports/Scorecard/`
- [ ] T031 [US4] Write the e2e spec `desktop/tests/e2e/scorecard.spec.ts` for quickstart 3; show the monthly leakage line (below-cost sales; roll variance and claims when tracked) for SC-004

---

## Phase 7: Polish

- [ ] T032 [P] Check every report screen in System, Light and Dark (quickstart 4)
- [ ] T033 [P] Move all new screen text into `desktop/src/renderer/strings.ts`
- [ ] T034 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`

---

## Dependencies and execution order

```
Setup --> Foundational --> US1 (M0, Sep 2027) ......... go-live
                              \--> US2 (Jan 2028) --> US3 --> US4 --> Polish
```

US2 to US4 reuse US1's engine, worker and export.

## Parallel examples

- Phase 2: T004 and T005 together.
- US1: T008 and T009 together.
- US3: T022 and T023 together.

## Implementation strategy

M0 gives the owner trustworthy daily reports at go-live. The V2 parts follow in the feature window, each traced to documents and reconciled before it is used.
