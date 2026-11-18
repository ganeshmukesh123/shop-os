# Contract: builder admin commands and API additions (feature 013)

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
| `exit start` / `exit delete-server-data` | `--business`                                         | Export and deletion steps (research D8)                                      |

## API additions (`/v1`, same conventions as 010)

| Method and path                               | Who         | Result                                                       | Codes                        |
| --------------------------------------------- | ----------- | ------------------------------------------------------------ | ---------------------------- |
| `GET /v1/entitlement`                         | device      | `{ jwt, features[], expiresAt, graceUntil }`                 |                              |
| `GET /v1/owner/support-requests`              | owner phone | pending requests                                             |                              |
| `POST /v1/owner/support-requests/{id}/decide` | owner phone | `{ grant }`                                                  | `EXPIRED`, `ALREADY_DECIDED` |
| `POST /v1/owner/support-grants/{id}/revoke`   | owner phone | `{ revokedAt }`                                              |                              |
| `POST /v1/owner/export`                       | owner       | `{ jobId }` then a download link to the SQLite file and CSVs |                              |

Cross-tenant rule for every route: a resource id from another business returns 404 `NOT_FOUND`, never 403.

## Desktop commands (IPC)

| Command              | Input        | Result                                                                                      |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| `onboarding.status`  | `{}`         | `{ steps[{ step, completedAt? }] }` (sent to the server as operations)                      |
| `entitlement.status` | `{}`         | `{ features[], expiresAt, inGrace, lapsed }`                                                |
| `data.exportAll`     | `{ folder }` | `{ files[] }` (SQLite file by online backup plus one CSV per table; requires `data.export`) |
