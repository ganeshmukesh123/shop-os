# Research: Reports, Expenses, Real Profit and CA Export

**Feature**: `specs/011-reports-expenses-export/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD section 10 Reports (FR-RPT-001 to 010), FR-CMP-004, FR-CMP-014, NFR-015, BO-3, the architecture reference sections 7.8, 8.2 (projections) and 11.10 (rebuilding projections), the constitution v2.1.0, feature 018's spec (moving long work off the main process), and the plans of 002 to 010 whose tables these reports read.

## Scope and timing

| Part                                                | Release (PRD) | Planned here | When                                                 |
| --------------------------------------------------- | ------------- | ------------ | ---------------------------------------------------- |
| US1 core reports (FR-001 to 003, FR-013)            | MVP           | Yes          | **M0, 13 to 26 September 2027**, before go-live (D1) |
| US2 expenses and real profit (FR-004, FR-005)       | V2            | Yes          | Feature window, 17 January to 13 February 2028       |
| US3 CA export (FR-011, FR-012)                      | V2            | Yes          | Feature window                                       |
| US4 distributor scorecard (FR-006)                  | V2            | Yes          | Feature window                                       |
| US4 contractor ranking (FR-007)                     | V3            | No           | After the PRD's Gate 2 scope review                  |
| US5 price impact, targets, area map (FR-008 to 010) | V3            | No           | Same                                                 |

Constitution VII keeps V3 items out until they are taken up; this plan leaves room for them (the same report engine).

## Decisions

### D1. Core reports must exist at go-live, so they move earlier

FR-RPT-001 to 003 are MVP, but 002 research D16 places this feature in January 2028, after go-live. The core reports (US1) are built as **M0 from 13 to 26 September 2027**, right after 012 and before go-live, pushing 015 by two weeks. 005's day-close summary covers the daily view until then. Owner decision OD-1.

### D2. Reports are SQL over the local database, run off the main process

- One local database per shop holds every document (constitution IV), so reports are SQLite queries with the indexes already planned (`bill(business_date)`, `bill_line(bill_id)`, `stock_balance`, `party_ledger_entry(party_id, business_date)`), plus three new ones (D7).
- Long queries run in an Electron `utilityProcess` with a read-only connection to the same file (WAL allows concurrent readers), so the counter never stalls (018's performance guidance, NFR-002). Results stream back in pages.
- Every report reads **current bill versions only** (003), excludes cancelled bills from sales and includes them in exceptions (spec edge case), and books returns in the period of the return (spec edge case).
- **Alternative rejected**: precomputed report projections for everything (architecture 8.2 lists `daily_snapshot`, `turnover_daily`, `item_sales_stat`). Those that exist are used; adding more projections means more tables to keep in step. A projection is added only if a report misses SC-001 (3 seconds for a day of 500 bills).

### D3. One report engine with definitions as data

Each report is a definition in `@shopos/core` (`ReportDefinition`: id, filters, grouping, columns with units, a drill target) and a query in the main process. The screen draws any definition the same way (Radix Table, totals row, filters, export). Drill-down (FR-013) is built in: every cell carries the filter that produces its documents, so a total opens its document list (tap 1), a row opens the documents (tap 2), and a document opens (tap 3), within NFR-015's 3 taps.

### D4. Export to Excel and CSV

- CSV always (no package). XLSX writing needs a package; this reuses 002's OD-2 decision (SheetJS Community Edition recommended). If the owner declined it, exports are CSV, which Excel opens.
- Exports larger than Excel's 1,048,576-row sheet limit are split into numbered parts with a note (spec edge case).
- Money is exported as rupees with two decimals in a number column, with a paise column alongside for the CA's reconciliation (no floating point in calculation; formatting only).

### D5. Cost of goods sold uses the cost on each bill line

- Real profit and margins use `bill_line.cost_paise`, the cost **at the time of sale** (batch landed cost, else the variant's purchase price; 002 and 003). Lines with no cost are counted in **cost completeness** = lines with cost / all lines, by value, leaving out `service` lines such as the delivery charge (006), which have no cost by nature (FR-005, EC-08), and shown as "Cost unknown" in margin reports, never hidden.
- **Dependency**: 003 must store `cost_paise` on every line, not only tinted ones (002 stores it for tinted lines; 003 reads cost for the below-cost guard). If a bill line lacks it, this feature does not invent one: it counts the line as cost unknown. Recorded for 003's tasks.

### D6. Real profit formula with terms that may not exist yet

Real profit = sales - returns - landed cost of goods sold - roll variance - rejected claims - write-offs - expenses (FR-005). Roll variance (007 V2), rejected claims (009 V3) and write-offs (004 V2) are not built in this plan's sequence; each term shows "Not tracked yet" and 0, so the figure is honest about what it includes. Owner drawings are recorded but are not an expense (they reduce the owner's capital, not profit).

### D7. Expenses

`expense_category` (seeded: rent, electricity, salaries, transport, tea and snacks, repairs, other; editable) and `expense(category_id, amount_paise, business_date, mode, note, cash_entry_id)`; `owner_drawing` the same shape. A cash expense also writes 005's `cash_entry` (`cash_expense`) in the same transaction, replacing 005's plain "Cash out" for expenses (005 D7 said 011 would link categories). Expenses are append-only; a mistake is reversed by a negative correction row with a reason.

### D8. CA export

- **Composition**: quarterly turnover for CMP-08 (due on the 18th after the quarter, PRD) and annual data for GSTR-4 (due 30 June, PRD), the purchases register (009), and a Tally-compatible file. Totals must equal 008's turnover tracker for the same period (US3 scenario 1).
- **Regular**: GSTR-1 data (B2B by GSTIN, B2C by rate, HSN summary, credit notes) and GSTR-3B summary (by rate). Formats: Excel and CSV laid out like the GST portal's offline tool templates (OI-2).
- **Tally**: the exact format is "the one the shop's CA uses" (spec assumption), to be confirmed before building (OI-1). Default plan: Tally's XML import of sales and purchase vouchers, which Tally documents for its import feature; unverified until the CA's version is known.
- **Reminders**: a compliance calendar with the due dates above, shown 7 days before (FR-011). Dates are settings, because they change by notification (OI-3).

### D9. Distributor scorecard

From 009's price history, receipts and debit notes: price trend (change over the last 3 and 12 months), delivery delay (009's proxy: receipt date minus invoice date), short-supply rate, roll variance ("No rolls yet" until 007's V2 rolls) and claim settlement time ("No claims yet" until 009's V3 claims).

### D10. No chart library

Reports are tables with totals; a trend is shown as a small table of periods. No chart package is added (spec assumption leaves the choice to the plan; constitution VII). If the owner wants charts later, the design guidelines' visual standard decides the library.

## Open items

| ID   | Item                                                                                  | Resolve by                                | Milestone |
| ---- | ------------------------------------------------------------------------------------- | ----------------------------------------- | --------- |
| OI-1 | The Tally version and import format the CA uses                                       | CA                                        | M3        |
| OI-2 | GSTR-1 and GSTR-3B layouts the CA wants (offline tool templates or the CA's software) | CA                                        | M3        |
| OI-3 | Due dates for CMP-08, GSTR-4, GSTR-1 and GSTR-3B for the shop's state and turnover    | CA                                        | M3        |
| OI-4 | Whether 003 stores `cost_paise` on every bill line (D5)                               | Check 003's code when this feature starts | M0        |

## Owner decisions needed

| ID   | Question                                                                           | Recommendation | Needed by   |
| ---- | ---------------------------------------------------------------------------------- | -------------- | ----------- |
| OD-1 | Build core reports (US1) in September 2027 before go-live, moving 015 by two weeks | Yes            | August 2027 |

## References

- Electron `utilityProcess`: https://www.electronjs.org/docs/latest/api/utility-process (primary).
- SQLite write-ahead logging (concurrent readers): https://www.sqlite.org/wal.html (primary).
- Microsoft Excel specifications and limits (1,048,576 rows): https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3 (primary vendor documentation).
- GST portal offline tools (GSTR-1 and others): https://www.gst.gov.in/download/returns (primary; layouts to confirm, OI-2).
- TallyPrime data import (XML): https://help.tallysolutions.com/ (primary vendor documentation; version to confirm, OI-1).
- Industry practice: Shopify reports trace each figure to its orders through report filters (https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports, primary vendor documentation). Square's sales reports export to CSV and Excel (https://squareup.com/help/us/en/article/5072-summaries-and-reports-from-the-online-square-dashboard, primary vendor documentation). D3 follows the same drill-down idea.
