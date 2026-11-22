# Contract: commands added or changed by feature 008

Rules as in `specs/001-shop-os-mvp/contracts/ipc-commands.md`, with 005's session and permission checks (`settings.edit` for registration and rates; `users.manage` not needed).

## Registration and rates

| Command                       | Input                                                                                            | Result                                                                        | Error codes                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| `gst.registration.current`    | `{ atMs? }`                                                                                      | `{ registration?, nextChange? }`                                              |                                                     |
| `gst.registration.history`    | `{}`                                                                                             | `{ rows[] }`                                                                  |                                                     |
| `gst.registration.setInitial` | `{ type, gstin, legalName, tradeName?, homeStateCode, effectiveFromMs }` (only when none exists) | `{ registration, series }`                                                    | `ALREADY_SET`, `INVALID_GSTIN`, `TEMPLATE_TOO_LONG` |
| `gst.rates.list`              | `{ hsnPrefix? }`                                                                                 | `{ rates[] }`                                                                 |                                                     |
| `gst.rates.add`               | `{ hsnPrefix, rateBp, effectiveFrom, sourceRef? }`                                               | `{ rate }` (closes the previous range the day before)                         | `OVERLAPPING_RANGE`, `INVALID_HSN`                  |
| `gst.itemOverride.add`        | `{ itemId, rateBp, effectiveFrom }`                                                              | `{ override }`                                                                |                                                     |
| `gst.rateFor`                 | `{ itemId, businessDate }`                                                                       | `{ rateBp, source: "override" or "hsn" or "category_default" or "fallback" }` |                                                     |

## Bills (changed)

`bills.save` and `bills.edit` calculate tax (research D2) for tax invoices and return `{ bill, lines }` with the tax fields. New error: none blocking; a missing HSN raises a `missing_hsn` exception and uses the fallback rate. `INTER_STATE_UNDER_COMPOSITION` uses the registration in force. `bills.print` and `bills.exportPdf` use `contracts/bill-formats.md`.

## Turnover

| Command                 | Input                | Result                                                                                                | Error codes      |
| ----------------------- | -------------------- | ----------------------------------------------------------------------------------------------------- | ---------------- |
| `gst.turnover.status`   | `{ financialYear? }` | `{ turnoverPaise, limitPaise, usedBp, level: "ok" or "warn80" or "warn95" or "crossed", crossedOn? }` |                  |
| `gst.turnover.setLimit` | `{ limitPaise }`     | `{ limitPaise }`                                                                                      | `INVALID_AMOUNT` |

## Scheme switch

| Command                    | Input                                                                  | Result                                                      | Error codes                             |
| -------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| `gst.switch.start`         | `{ toType, effectiveFromMs }`                                          | `{ switch }`                                                | `NOT_IN_FUTURE`, `SWITCH_IN_PROGRESS`   |
| `gst.switch.checklist`     | `{ switchId }`                                                         | `{ items[{ check, ok, failures[] }] }`                      |                                         |
| `gst.switch.closingStock`  | `{ switchId }`                                                         | `{ pdfPath, csvPath, totals }`                              |                                         |
| `gst.switch.suggestPrices` | `{ switchId, choice: "keep_final" or "add_gst" }`                      | `{ suggestions[{ itemId, currentPaise, suggestedPaise }] }` |                                         |
| `gst.switch.confirm`       | `{ switchId, caName, prices[{ itemId, pricePaise }], seriesTemplate }` | `{ switch, registration, series }`                          | `CHECKLIST_FAILED`, `TEMPLATE_TOO_LONG` |
| `gst.switch.cancel`        | `{ switchId, reason }`                                                 | `{ switch }`                                                | `ALREADY_EFFECTIVE`                     |

`gst.switch.confirm` atomically schedules the registration, new series and audited price changes for `effective_from_ms`. Billing retains its current scheme and prices before that instant. `gst.switch.cancel` is allowed only before that instant and prevents all three scheduled changes.

`gst.switch.closingStock` can return a preview before the switch. Generate or refresh the final statement when the switch takes effect, regardless of when the owner confirmed. Use movements with `occurred_at < effective_from_ms` (strictly before: a movement at the switch instant belongs to the new scheme, as registration selection assigns it) and exclude later activity, even if the report is generated after that instant. The final statement is read in one read transaction that starts after `effective_from_ms`; the app has a single SQLite writer, so every local movement stamped before the instant has committed by then. A movement synced later from another device (010) with an earlier `occurred_at` marks the statement stale and it is regenerated; it becomes final only when no device has unsynced movements before the cutoff.

## Privacy (milestone M0)

| Command                                             | Input                                                                              | Result                                                                          | Error codes                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| `privacy.notice.current` / `privacy.notice.publish` | `{ language }` / `{ language, body }`                                              | `{ notice }`                                                                    |                                                 |
| `parties.create` and the 003 quick-add (changed)    | consent ticks required: `{ consent: { transactional, marketing, noticeVersion } }` |                                                                                 | `CONSENT_REQUIRED` (transactional tick missing) |
| `privacy.withdraw`                                  | `{ partyId, purpose }`                                                             | `{ consent }`                                                                   |                                                 |
| `privacy.requests.create`                           | `{ partyId, kind, note? }`                                                         | `{ request }` (due date set)                                                    |                                                 |
| `privacy.requests.export`                           | `{ requestId }`                                                                    | `{ jsonPath, pdfPath }`                                                         |                                                 |
| `privacy.requests.erase`                            | `{ requestId }`                                                                    | `{ request }` (`done`, or `deferred` with reason when a balance is outstanding) |                                                 |
| `privacy.requests.list` / `.close`                  |                                                                                    |                                                                                 | `NOTE_REQUIRED`                                 |
