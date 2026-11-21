# Contract: commands added by feature 011

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:4c990c3ed301367b08c562fb4ebdf774dcc69d7580a2b20d75565d23d7bc5e8c -->

Rules as in `specs/001-shop-os-mvp/contracts/ipc-commands.md`, using the editable role permissions from feature 005. Feature 011 adds `report.view` (Owner, Manager, Accountant by default). Margin and profit data require `report.profit`; exports require `data.export`. Both keys and their defaults are defined in `specs/005-roles-approvals-audit/data-model.md` under `role_permission` and Seeded permissions (PRD section 15). Counter cannot export by default. Exports are audited.

## Reports

| Command          | Input                                                      | Result                                                                                                                | Error codes                                             |
| ---------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `reports.list`   | `{}`                                                       | `{ definitions[{ id, title, filters, groupBy }] }` (only those the role may see)                                      |                                                         |
| `reports.run`    | `{ reportId, filters, groupBy?, page?, pageSize? }`        | `{ columns, rows[{ cells[{ value, unit, drill? }] }], totals, page, hasMore, ranAtMs }` (runs in the utility process) | `PERMISSION_DENIED`, `INVALID_FILTER`, `REPORT_TIMEOUT` |
| `reports.drill`  | `{ drill }` (from a cell)                                  | `{ documents[{ docType, docId, docNo, date, amountPaise, status }] }`                                                 |                                                         |
| `reports.export` | `{ reportId, filters, format: "csv" or "xlsx", filePath }` | `{ files[], rowCount, parts }`                                                                                        | `PERMISSION_DENIED`, `WRITE_FAILED`, `XLSX_NOT_AVAILABLE`                    |

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:8e79e21923a59935faf87431f717de2c91572f37801e735b0b2935396c17fe9c -->

## Expenses

| Command                              | Input                                                                     | Result                    | Error codes                                |
| ------------------------------------ | ------------------------------------------------------------------------- | ------------------------- | ------------------------------------------ |
| `expenses.categories.list` / `.save` |                                                                           | `{ categories[] }`        | `DUPLICATE_NAME`                           |
| `expenses.add`                       | `{ clientExpenseId, categoryId, amountPaise, businessDate, mode, note? }` | `{ expense, cashEntry? }` | `NO_OPEN_SESSION` (cash), `INVALID_AMOUNT` |
| `expenses.correct`                   | `{ expenseId, reason }`                                                   | `{ correction }`          | `ALREADY_CORRECTED`, `REASON_REQUIRED`     |
| `drawings.add` / `drawings.correct`  | as expenses without category                                              |                           |                                            |
| `expenses.list`                      | `{ from, to, categoryId? }`                                               | `{ rows[], totalPaise }`  |                                            |

`expenses.add` persists `clientExpenseId` as `expense.client_expense_id`, unique per shop. A retry with the same key returns the original expense and its linked cash entry, if any, even after restart or after the original cash session closes. It creates no new expense or cash entry.

<!-- /coderabbit-ai-generated:v1 -->

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
