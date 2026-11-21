# Contract: commands added by feature 012

Rules as in `specs/001-shop-os-mvp/contracts/ipc-commands.md`, with 005's checks (owner only unless stated). Imports are 002's `import.items.*` and `import.shades.*` and 004's `import.parties.*`; merging is 002's `items.merge`.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:9e4101a97657f2c2e0a32b8da7c20cad456b81298f187d596e75488a3ce57c79 -->

| Command                                                      | Input                                                                            | Result                                                                         | Error codes                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `golive.readiness`                                           | `{}`                                                                             | `{ status: "ready" or "not_ready", gaps[{ kind, count, sample[] }], counts }`  |                                                         |
| `golive.setReadinessInput`                                   | `{ creditPartiesInOldBooks, goLiveDate, top500ItemKeys }`                                        | `{ input }`                                                                    |                                                         |
| `golive.signoff.list` / `golive.signoff.mark`                | `{}` / `{ code, note? }`                                                         | `{ items[] }`                                                                  |                                                         |
| `training.enter`                                             | `{}`                                                                             | `{ mode: "training" }` (reopens on `training.sqlite`; app reloads)             | `TRAINING_DB_FAILED`                                    |
| `training.leave`                                             | `{}`                                                                             | `{ mode: "live" }`                                                             |                                                         |
| `training.reset`                                             | `{}`                                                                             | `{ resetAt }`                                                                  |                                                         |
| `training.records.list` / `training.records.save`            | `{}` / `{ userId, sessionNo, heldOn, testBillsUnaided, isChampion?, note? }`     | `{ records[] }`                                                                | `CHAMPION_EXISTS`, `TRAINING_MODE` (save)                                       |
| `reconcile.day`                                              | `{ businessDate }`                                                               | `{ systemSalesPaise, systemCashExpectedPaise, countedCashPaise?, lastEntry? }` |                                                         |
| `reconcile.enter`                                            | `{ businessDate, oldBookTotalPaise, footfallEstimate?, note? }`                  | `{ entry, differencePaise }`                                                   |                                                         |
| `reconcile.share`                                            | `{ from, to }`                                                                   | `{ days[{ date, shareBp }], weekShareBp, targetBp: 9500 }`                     |                                                         |
| `reconcile.bypass`                                           | `{ days: 14 }`                                                                   | `{ rows[{ date, bills, footfall?, cashDifferencePaise }] }`                    |                                                         |
| `bills.backfillPaper` (counter roles)                        | `bills.save` input plus `{ paperBillNo, paperBusinessDate }`                                        | `{ bill }` (bill number = the paper number)                                    | `DUPLICATE_BILL_NO`, `BILL_NO_TOO_LONG`, `NOT_SAME_DAY` |
| `accuracy.top200`                                            | `{ asOf? }`                                                                      | `{ accuracyBp, counted, matched, mismatches[] }`                               |                                                         |
| `gates.list` / `gates.record`                                | `{}` / `{ gate, heldOn, outcome, complaints[], durationMinutes?, note? }`        | `{ reviews[] }`                                                                |                                                         |
| `features.list` / `features.switchOn` / `features.switchOff` | `{}` / `{ featureCode, walkthroughOn, attendees[] }` / `{ featureCode, reason }` | `{ switches[] }`                                                               | `WALKTHROUGH_REQUIRED`                                  |
| `release.status`                                             | `{}`                                                                             | `{ version, previousVersion?, preUpgradeBackupPath?, allAdditive }`            |                                                         |

For a new backfill, the operator transcribes the date on the physical bill as `paperBusinessDate` (YYYY-MM-DD). Compare it to the Asia/Kolkata business date of the same save timestamp used to post the bill. Refuse a different date with `NOT_SAME_DAY` before posting. Ordinary `bills.save` still derives its date at save time.

Practice commands use `training.sqlite`. In training mode, `training.records.save`, `sync.*` and `backup.cloud*` return `TRAINING_MODE`. The training screen directs the trainer to leave training, then enter session results against the live staff list. Live readiness reads those live records.


<!-- /coderabbit-ai-generated:v1 -->