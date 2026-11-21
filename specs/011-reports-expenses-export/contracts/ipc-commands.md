# Contract: commands added by feature 011

Rules as in `specs/001-shop-os-mvp/contracts/ipc-commands.md`, using the editable role permissions from feature 005. Feature 011 adds `report.view` (Owner, Manager, Accountant by default). Margin and profit data require `report.profit`; exports require `data.export`. Both keys and their defaults are defined in `specs/005-roles-approvals-audit/data-model.md` under `role_permission` and Seeded permissions (PRD section 15). Counter cannot export by default. Exports are audited.

## Reports

| Command          | Input                                                      | Result                                                                                                                | Error codes                                               |
| ---------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `reports.list`   | `{}`                                                       | `{ definitions[{ id, title, filters, groupBy }] }` (only those the role may see)                                      |                                                           |
| `reports.run`    | `{ reportId, filters, groupBy?, page?, pageSize? }`        | `{ columns, rows[{ cells[{ value, unit, drill? }] }], totals, page, hasMore, ranAtMs }` (runs in the utility process) | `PERMISSION_DENIED`, `INVALID_FILTER`, `REPORT_TIMEOUT`   |
| `reports.drill`  | `{ drill }` (from a cell)                                  | `{ documents[{ docType, docId, docNo, date, amountPaise, status }] }`                                                 |                                                           |
| `reports.export` | `{ reportId, filters, format: "csv" or "xlsx", filePath }` | `{ files[], rowCount, parts }`                                                                                        | `PERMISSION_DENIED`, `WRITE_FAILED`, `XLSX_NOT_AVAILABLE` |

## Expenses

| Command                              | Input                                                                     | Result                    | Error codes                                |
| ------------------------------------ | ------------------------------------------------------------------------- | ------------------------- | ------------------------------------------ |
| `expenses.categories.list` / `.save` |                                                                           | `{ categories[] }`        | `DUPLICATE_NAME`                           |
| `expenses.add`                       | `{ clientExpenseId, categoryId, amountPaise, businessDate, mode, note? }` | `{ expense, cashEntry? }` | `NO_OPEN_SESSION` (cash), `INVALID_AMOUNT` |
| `expenses.correct`                   | `{ expenseId, reason }`                                                   | `{ correction }`          | `ALREADY_CORRECTED`, `REASON_REQUIRED`     |
| `drawings.add` / `drawings.correct`  | as expenses without category                                              |                           |                                            |
| `expenses.list`                      | `{ from, to, categoryId? }`                                               | `{ rows[], totalPaise }`  |                                            |

`expenses.add` persists `clientExpenseId` as `expense.client_expense_id`, unique per shop. A retry with the same key returns the original expense and its linked cash entry, if any, even after restart or after the original cash session closes. It creates no new expense or cash entry.

## Profit, scorecard

| Command                  | Input          | Result                                                                                                                                                                                               |
| ------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profit.real`            | `{ from, to }` | `{ salesPaise, returnsPaise, cogsPaise, costCompletenessBp (null when no goods were sold), unknownReturnCostCount, isComplete, expensesPaise, terms[{ name, paise?, isTracked }], realProfitPaise }` |
| `scorecard.distributors` | `{ from, to }` | `{ rows[{ party, priceTrendBp, avgDelayDays?, shortSupplyBp, rollVariance: null, claimDays: null }] }`                                                                                               |

`profit.real` sets `isComplete` to false when any sale line in the period has no cost or any restocked return has no known original cost (`unknownReturnCostCount` above 0). The screen then shows the total as "at least" or "at most" with the reason ("Profit incomplete: 2 returns have no original cost"), never as an exact figure.

## CA export and calendar

| Command                                                       | Input                                     | Result                                       | Error codes                        |
| ------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------- | ---------------------------------- |
| `caExport.cmp08`                                              | `{ quarter, filePath }`                   | `{ files[], turnoverPaise, matchesTracker }` | `PERIOD_NOT_CLOSED` (warning only) |
| `caExport.gstr4` / `caExport.purchases` / `caExport.tally`    | `{ financialYear or from, to, filePath }` | `{ files[] }`                                | `TALLY_FORMAT_NOT_SET`             |
| `caExport.gstr1` / `caExport.gstr3b`                          | `{ month, filePath }`                     | `{ files[] }`                                | `NOT_REGULAR_IN_PERIOD`            |
| `calendar.list` / `calendar.markDone` / `calendar.setDueDate` |                                           | `{ items[] }`                                |                                    |
