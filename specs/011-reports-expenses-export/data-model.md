# Data Model: Reports, Expenses, Real Profit and CA Export

Reports read the tables of 001 to 009 (bills and versions, lines with cost, tenders, returns, stock movements and balances, ledger, purchases, cash, approvals, exceptions, turnover). This feature adds few tables. Conventions unchanged. Decisions in `research.md` D1 to D10.

## New tables

### `expense_category`

`name` (1-40, unique per shop, case-insensitive), `is_active`. Seeded: Rent, Electricity, Salaries, Transport, Tea and snacks, Repairs, Other.

### `expense` (append-only)

| Field                                  | Rule                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| category_id                            | FK                                                                                             |
| amount_paise                           | integer, not 0; negative only for a correction, which needs `corrects_expense_id` and a reason |
| business_date                          | `YYYY-MM-DD`                                                                                   |
| mode                                   | `cash`, `upi`, `bank_transfer`, `card`                                                         |
| note                                   | text up to 200                                                                                 |
| cash_entry_id                          | FK to 005's `cash_entry` when `mode = 'cash'` (written in the same transaction)                |
| corrects_expense_id, correction_reason | nullable; set together                                                                         |
| user_id                                |                                                                                                |

### `owner_drawing` (append-only)

Same shape as `expense` without `category_id`; cash drawings write a `cash_drop`-like 005 entry of kind `owner_drawing` (new, negative).

### `compliance_calendar`

`kind` (`cmp08`, `gstr4`, `gstr1`, `gstr3b`, `custom`), `period_label` (for example "Q1 2027-28"), `due_date`, `reminder_days` (default 7), `done_at` (nullable), `note`. Generated for the financial year from settings (research D8); due dates editable.

### `export_job`

`kind` (`sales`, `exceptions`, `stock_value`, `profit`, `ca_cmp08`, `ca_gstr4`, `ca_purchases`, `ca_tally`, `ca_gstr1`, `ca_gstr3b`, `scorecard`), `filters_json`, `format` (`csv`, `xlsx`, `xml`), `file_paths_json`, `row_count`, `created_at`, `user_id`. Each export is also an audit entry (005, `data.export`).

## Changed tables

- `cash_entry.kind` (005) adds `owner_drawing`.
- Indexes added for report speed: `bill_line(variant_id)`, `bill(user_id, business_date)`, `bill_tender(mode)`, `sales_return(business_date)`.

## Report definitions (in `@shopos/core`)

```ts
interface IReportDefinition {
  id: ReportId; // "sales_by_item", "exceptions", "stock_value", ...
  filters: ReportFilter[]; // date range, location, category, staff, party, payment mode
  groupBy: ReportDimension[]; // day, item, category, brand, staff, customer, payment_mode, location
  columns: IReportColumn[]; // each with a unit: "paise", "milli", "count", "bp"
  drillTarget: DrillTarget; // which document list a cell opens
}
```

Planned definitions: `sales_by_day`, `sales_by_item`, `sales_by_category`, `sales_by_brand`, `sales_by_staff`, `sales_by_customer`, `sales_by_payment_mode`, `exceptions`, `stock_value_by_location`, `stock_value_by_category`, `real_profit`, `expenses_by_category`, `distributor_scorecard`.

## Derived values (in `@shopos/core`)

- `salesFigures(lines, returns)`: gross, discounts, returns, net; cancelled excluded; returns in their own period.
- `costCompleteness(lines)`: share of line value with a cost, in basis points.
- `realProfit({ salesPaise, returnsPaise, cogsPaise, rollVariancePaise?, rejectedClaimsPaise?, writeOffsPaise?, expensesPaise })` with "not tracked" for absent terms.
- `stockValueAtCost(balances, costs)`.
- `exceptionRows({ cancels, edits, overDiscount, belowCost, negativeStock, returnsWithoutBill })`.
- `caTurnover(period)` equal to 008's `turnoverForYear` for the same days.
- `splitForRowLimit(rows, limit = 1048576)`.
- `scorecardMeasures(receipts, priceHistory, debitNotes)`.

Example: a month with sales ₹4,52,000, returns ₹12,000, cost of goods ₹3,41,000 (cost completeness 96%), expenses ₹38,500: real profit ₹60,500, shown with "Roll variance, rejected claims, write-offs: not tracked yet".
