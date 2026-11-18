# Contract: commands added by feature 011

Rules as in `specs/001-shop-os-mvp/contracts/ipc-commands.md`, with 005's checks: reports need `report.view` (new: Owner, Manager, Accountant allow); margins and profit need `report.profit` (005); exports need `data.export` (005) and are audited.

## Reports

| Command          | Input                                                      | Result                                                                                                                | Error codes                                             |
| ---------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `reports.list`   | `{}`                                                       | `{ definitions[{ id, title, filters, groupBy }] }` (only those the role may see)                                      |                                                         |
| `reports.run`    | `{ reportId, filters, groupBy?, page?, pageSize? }`        | `{ columns, rows[{ cells[{ value, unit, drill? }] }], totals, page, hasMore, ranAtMs }` (runs in the utility process) | `PERMISSION_DENIED`, `INVALID_FILTER`, `REPORT_TIMEOUT` |
| `reports.drill`  | `{ drill }` (from a cell)                                  | `{ documents[{ docType, docId, docNo, date, amountPaise, status }] }`                                                 |                                                         |
| `reports.export` | `{ reportId, filters, format: "csv" or "xlsx", filePath }` | `{ files[], rowCount, parts }`                                                                                        | `WRITE_FAILED`, `XLSX_NOT_AVAILABLE`                    |

## Expenses

| Command                              | Input                                                                     | Result                    | Error codes                                |
| ------------------------------------ | ------------------------------------------------------------------------- | ------------------------- | ------------------------------------------ |
| `expenses.categories.list` / `.save` |                                                                           | `{ categories[] }`        | `DUPLICATE_NAME`                           |
| `expenses.add`                       | `{ clientExpenseId, categoryId, amountPaise, businessDate, mode, note? }` | `{ expense, cashEntry? }` | `NO_OPEN_SESSION` (cash), `INVALID_AMOUNT` |
| `expenses.correct`                   | `{ expenseId, reason }`                                                   | `{ correction }`          | `ALREADY_CORRECTED`, `REASON_REQUIRED`     |
| `drawings.add` / `drawings.correct`  | as expenses without category                                              |                           |                                            |
| `expenses.list`                      | `{ from, to, categoryId? }`                                               | `{ rows[], totalPaise }`  |                                            |

## Profit, scorecard

| Command                  | Input          | Result                                                                                                                            |
| ------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `profit.real`            | `{ from, to }` | `{ salesPaise, returnsPaise, cogsPaise, costCompletenessBp, expensesPaise, terms[{ name, paise?, isTracked }], realProfitPaise }` |
| `scorecard.distributors` | `{ from, to }` | `{ rows[{ party, priceTrendBp, avgDelayDays?, shortSupplyBp, rollVariance: null, claimDays: null }] }`                            |

## CA export and calendar

| Command                                                       | Input                                     | Result                                       | Error codes                        |
| ------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------- | ---------------------------------- |
| `caExport.cmp08`                                              | `{ quarter, filePath }`                   | `{ files[], turnoverPaise, matchesTracker }` | `PERIOD_NOT_CLOSED` (warning only) |
| `caExport.gstr4` / `caExport.purchases` / `caExport.tally`    | `{ financialYear or from, to, filePath }` | `{ files[] }`                                | `TALLY_FORMAT_NOT_SET`             |
| `caExport.gstr1` / `caExport.gstr3b`                          | `{ month, filePath }`                     | `{ files[] }`                                | `NOT_REGULAR_IN_PERIOD`            |
| `calendar.list` / `calendar.markDone` / `calendar.setDueDate` |                                           | `{ items[] }`                                |                                    |
