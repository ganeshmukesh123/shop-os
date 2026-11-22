# Contract: commands added or changed by feature 004

Rules as in `specs/001-shop-os-mvp/contracts/ipc-commands.md`. Commands that need approval return `APPROVAL_REQUIRED` with `{ kind, amountPaise, reason }` and are called again with an `approvalId` from feature 005.

## Parties

| Command                 | Input                                                                                                                                                                                            | Result                                                                                     | Error codes                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------- |
| `parties.search`        | `{ query, type?, includeInactive?, limit }` (name or phone digits)                                                                                                                               | `{ parties[{ id, name, type, primaryPhone, balancePaise, creditLimitPaise, isOverdue }] }` |                                  |
| `parties.create`        | `{ type, name, phones[{ phone, isPrimary }], address?, area?, pinCode?, gstin?, tierCode?, creditLimitPaise?, creditDays?, referredByPartyId?, notes?, consent?: { transactional, marketing } }` | `{ party, warnings[] }` (`SAME_PHONE_AS` other parties, `GSTIN_CHECK_FAILED`)              | `INVALID_FIELD`, `INVALID_PHONE` |
| `parties.update`        | `{ id, ...fields }`                                                                                                                                                                              | `{ party, warnings[] }`                                                                    | `NOT_FOUND`                      |
| `parties.setActive`     | `{ id, isActive }`                                                                                                                                                                               | `{ party }`                                                                                |                                  |
| `parties.get`           | `{ id }`                                                                                                                                                                                         | `{ party, phones, balancePaise, consent, ageing }`                                         | `NOT_FOUND`                      |
| `parties.setPrices`     | `{ partyId, prices[{ itemId, pricePaise }] }`                                                                                                                                                    | `{ prices[] }`                                                                             |                                  |
| `parties.recordConsent` | `{ partyId, purpose, granted, source }`                                                                                                                                                          | `{ consent }`                                                                              |                                  |

## Ledger, credit and ageing

| Command              | Input                                        | Result                                                                                  | Error codes                          |
| -------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------ |
| `ledger.list`        | `{ partyId, from?, to? }`                    | `{ openingPaise, entries[{ entry, openPaise? }], closingPaise }`                        |                                      |
| `ledger.ageing`      | `{ partyId? }` (none = all parties)          | `{ rows[{ partyId, buckets: { d0to30, d31to60, d61to90, over90 }, bills[] }], totals }` |                                      |
| `ledger.checkCredit` | `{ partyId, newCreditPaise }`                | `{ status: "ok" or "warn_near_limit" or "over_limit" or "overdue", reason?, usedBp }`   |                                      |
| `ledger.adjust`      | `{ partyId, amountPaise, note, approvalId }` | `{ entry }`                                                                             | `APPROVAL_REQUIRED`, `NOTE_REQUIRED` |
| `ledger.verify`      | `{}`                                         | `{ partiesChecked, mismatches[] }` (also runs at start and nightly)                     |                                      |

## Bills (changed)

`bills.save` accepts `partyId` and `paymentMode: "credit"`; the bill and its `bill_credit` entry are one transaction; over limit or overdue returns `APPROVAL_REQUIRED` (kind `over_credit`). `bills.cancel` of a credit bill writes `bill_cancel_reverse` and releases active allocations in the same transaction under the [credit bill cancellation rule](../data-model.md#ledger_allocation-append-only). New error: `CREDIT_NEEDS_PARTY`, `CREDIT_NOT_ALLOWED` (party has no limit).

`PartyLedgerPort` (used by 003): `postBillCredit`, `reverseBillCredit`, `postCreditNote`, `checkCredit`, all inside the caller's transaction.

## Payments

| Command                                           | Input                                                                                                                  | Result                                            | Error codes                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `payments.receive`                                | `{ clientPaymentId, partyId, mode, amountPaise, reference?, cheque?: { number, bank, date }, allocateTo?: billIds[] }` | `{ payment, entry, allocations[], advancePaise }` | `REFERENCE_REQUIRED`, `DUPLICATE_REFERENCE`, `CHEQUE_DETAILS_REQUIRED`, `INVALID_AMOUNT` |
| `payments.reverse`                                | `{ paymentId, note }`                                                                                                  | `{ entry, allocations[] }`                        | `ALREADY_REVERSED`, `NOTE_REQUIRED`                                                      |
| `payments.list`                                   | `{ partyId?, from?, to? }`                                                                                             | `{ payments[] }`                                  |                                                                                          |
| `payments.printReceipt` / `payments.shareReceipt` | `{ id, target? }` / `{ id }`                                                                                           | `{ printed }` / `{ pdfPath, whatsappUrl }`        | `PRINT_FAILED`, `NO_PHONE`                                                               |

`payments.receive` rejects the request with `INVALID_FIELD` if any `allocateTo` bill belongs to a different party. The payment and allocations are not written.

## Statements and reminders

| Command                             | Input                                  | Result                                                              | Error codes                                           |
| ----------------------------------- | -------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| `statements.build`                  | `{ partyId, from, to }`                | `{ statement, pdfPath }`                                            |                                                       |
| `statements.share`                  | `{ partyId, from, to, templateCode? }` | `{ pdfPath, whatsappUrl, log }`                                     | `NO_PHONE`, `UPI_NOT_SET_UP` (link left out, warning) |
| `reminders.overdueList`             | `{ minDaysOverdue? }`                  | `{ parties[{ partyId, name, phone, overduePaise, oldestBillNo }] }` |                                                       |
| `reminders.prepare`                 | `{ partyId, templateCode }`            | `{ whatsappUrl, log }` (logged as prepared)                         | `NO_PHONE`                                            |
| `templates.list` / `templates.save` |                                        | `{ templates[] }`                                                   | `UNKNOWN_PLACEHOLDER`                                 |

## Import

| Command                  | Input                                | Result                                                                                          | Error codes                                               |
| ------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `import.parties.preview` | `{ filePath }`                       | `{ previewId, rowsOk, errors[{ row, column, message }], duplicateGroups[], openingTotalPaise }` | `UNREADABLE_FILE`                                         |
| `import.parties.commit`  | `{ previewId, confirmedTotalPaise }` | `{ partiesCreated, openingEntries }`                                                            | `TOTAL_MISMATCH`, `PREVIEW_HAS_ERRORS`, `PREVIEW_EXPIRED` |
