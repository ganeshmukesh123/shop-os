# Contract: builder admin commands and API additions (feature 013)

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ab213b828795f08064511301b9792e765c9936696dbd70ead7b0caec76962d05 -->

## Builder admin commands (server CLI, audited)

Run on the server as `pnpm --filter @shopos/server admin <command>`. Every command writes a server audit row with the builder's identity.

| Command                                  | Arguments                                            | Effect                                                                       |
| ---------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `create-business`                        | `--name`                                             | New business; prints its id                                                  |
| `create-shop`                            | `--business --name --state-code --time-zone`         | New shop with default settings; prints an owner registration code            |
| `pilot add`                              | `--shop --cohort --via`                              | `pilot_shop_status` row                                                      |
| `usage`                                  | `--cohort [--week]`                                  | Weekly usage table per shop (aggregates only) and the week-8 retention count |
| `plans list` / `plans set`               | `--code --limits`                                    | Plan definitions                                                             |
| `subscribe`                              | `--business --plan --from --to`                      | Subscription record (payment taken outside the app)                          |
| `offer`                                  | `--business --plan` / `offer decide --id --decision` | Plan offers and decisions                                                    |
| `support request`                        | `--business --reason --hours`                        | Sends an access request to the owner's phone                                 |
| `support read`                           | `--grant --what`                                     | Read-only views while a grant is active                                      |
| `reports`                                | `--cohort`                                           | Problem reports across shops with shop, user and screen                      |
| `exit start` / `exit delete-server-data` | `--business [--shop]`                                | Exit one shop if specified, otherwise the whole business (D8)                                      |

## API additions (`/v1`, same conventions as 010)

| Method and path                               | Who         | Result                                                       | Codes                        |
| --------------------------------------------- | ----------- | ------------------------------------------------------------ | ---------------------------- |
| `GET /v1/entitlement`                         | device      | `{ jwt, features[], expiresAt, graceUntil }`                 |                              |
| `GET /v1/owner/support-requests`              | owner phone | pending requests                                             |                              |
| `POST /v1/owner/support-requests/{id}/decide` | owner phone | `{ grant }`                                                  | `EXPIRED`, `ALREADY_DECIDED` |
| `POST /v1/owner/support-grants/{id}/revoke`   | owner phone | `{ revokedAt }`                                              |                              |
| `POST /v1/owner/export`                       | owner       | `{ jobId }` then a download link to the SQLite file and CSVs |                              |

For `POST /v1/owner/export`, an optional `shopId` selects a shop within the owner's business; omitting it exports the whole business. Both CLI exit steps must use the same scope as the confirmed export.

<!-- /coderabbit-ai-generated:v1 -->

Cross-tenant rule for every route: a resource id from another business returns 404 `NOT_FOUND`, never 403.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:fc2a1a56063601c405eba242eb94ba77d75dd6ccbd65d77a53fcbe11c8f1a9c9 -->

## Desktop commands (IPC)

| Command              | Input        | Result                                                                                      |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| `onboarding.status`  | `{}`         | `{ steps[{ step, completedAt? }] }` (sent to the server as operations)                      |
| `entitlement.status` | `{}`         | `{ features[], expiresAt, inGrace, lapsed }`                                                |
| `data.exportAll`     | `{ folder }` | `{ files[] }` (SQLite file plus one CSV per exported table; requires `data.export`)         |

Resolve the authorized business and optional shop from trusted command context. For a shop-scoped export, read from a consistent source snapshot and populate a fresh SQLite database with every row in scope: all facts and settings for that shop and all master data shared by its business. For A1, this includes shared items created by A2, but no A2 facts or settings, and no rows from another business. Write the CSVs from the same scoped contents. Keep the SQLite schema and references intact; fail on unclassified tables rather than copying them. Do not hand out a filtered copy of an unscoped SQLite file, where excluded data could remain in unused pages.

For exports without a shop scope, retain SQLite's online backup API for the authorized whole-business database. Only back up a source that contains no rows outside the authorized scope. Plan lapse never blocks export.

<!-- /coderabbit-ai-generated:v1 -->
