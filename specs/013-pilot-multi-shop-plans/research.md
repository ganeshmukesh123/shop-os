# Research: Pilot with Other Shops, Multi-Shop Separation and Paid Plans

**Feature**: `specs/013-pilot-multi-shop-plans/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD sections 1 (decisions of 12 November 2026), 2 (BO-6), 3 (non-goals), 15 (pilot, risks, success metrics, pricing constraint), NFR-008, NFR-016, the architecture reference sections 3 (server modules), 6.10 (packs), 8.1 (tenancy, row-level security), 12.3 (security) and 12.5 (scale), the constitution v2.1.0 (principle IV: business and shop ids from day one), and the plans of 008 (erasure), 010 (server, devices, row-level security, backups), 011 (exports) and 012 (onboarding procedures, feature switches, training).

**Timing**: tools from 6 March to 2 April 2028, only after Gate 3 (PRD); the pilot itself runs 8 weeks after the first shop starts.

## Decisions

### D1. Tenancy is already in every row; this feature proves it

- Tenant records carry `business_id` and use `shop_id` for shop ownership or origin (constitution IV, from 001). The shared `plan` catalogue is global and excluded from tenant pull; subscription and offer records are business scoped. The server enforces row-level security by `business_id` and fails closed (010). This feature adds what a second business needs on top: shop scoping on devices, an automated cross-tenant test suite, per-business backup keys and support-access control.
- **Shape**: a business can have several shops; a counter device belongs to one shop; the owner's phone sees all shops of its business. **Master data** (items, parties, price tiers, roles) is per business; **facts** (bills, movements, ledger, cash, counts) and **settings** (registration, series, tax, limits, locations) are per shop (FR-002, FR-CMP-017). A shop with two locations is two shops in one business (spec edge case).
- **Pull scope**: a device receives its business's master data and only its own shop's facts; the server's pull query filters by both (010's `sync_log` has both ids). A contractor known to two pilot shops is two unrelated parties (spec edge case).

### D2. Cross-tenant security test suite (SC-001)

- **Server**: for every route in `contracts/sync-api.md` and this feature's admin routes, a test calls it with business B's token and business A's ids and expects 404 (not 403, so ids are not confirmed); row-level-security tests run every server query with the tenant setting for B against A's rows; snapshot and backup downloads are checked for the business in the token.
- **Device**: a test database holding two shops' facts (as a multi-shop business's owner device could) runs every list, report and export command and asserts no row from the other shop appears.
- Run in CI as a required check.

### D3. Builder administration without self-signup

Self-signup is out of scope (spec assumption). The builder creates businesses, shops and the first owner registration code with a server admin command (`pnpm --filter @shopos/server admin create-business`, `create-shop`), which writes an audit record. No admin web console is built for the pilot.

### D4. Onboarding uses 012's tools, tracked per shop

The onboarding checklist is 012's readiness check, sign-off list and training records, plus "first real bill saved". Each step's completion is sent to the server as an operation, so the builder sees per-shop onboarding status (FR-003). Target: empty to first real bill within one working day (SC-002).

### D5. Starter catalogues as import templates, not packs

- **Decision**: per department (electrical, plumbing, paint, tools, hardware) a CSV starter file in `catalogue/starters/` with common families, axes and units from the architecture's template catalogue (section 6.11), loaded through 002's item import with its preview (FR-004, SHOULD). Every row is marked unverified (architecture 6.10: unverified research rows must say so); HSN and rates are left for the shop's CA to confirm.
- **Rejected for now**: the architecture's versioned pack engine (YAML packs, CI validator, system rows with a null business id). It pays off with many shops and frequent catalogue updates; for 10 pilot shops, import templates are enough. Revisit after the pilot.

### D6. Usage figures without personal data

Weekly per-shop figures computed on the server from `sync_log` metadata and projections only: active days (days with at least one bill), bill count, sales total, share billed in the system (from 012's reconciliation operations), overdue khata total, open problem reports. No party names, phones or line items leave the shop's scope in this view (FR-005, US3 scenario 3). Week-8 retention = shops active 5 or more days in each of the last weeks, against 7 of 10 (SC-003).

### D7. Plans and entitlements that never block billing

- `plan` (code, name, limits such as devices and premium features), `subscription` (business, plan, state `trial`, `active`, `lapsed`, `cancelled`, period dates), `plan_offer` (business, plan, offered on, decision `accepted`, `declined`, `later`, decided on) (FR-006, FR-007).
- Devices receive a signed **entitlement** (a JWT from the server listing enabled premium features and its expiry, with a 14-day grace period offline). Premium features are 012's feature switches; when an entitlement lapses, those switches pause. **Billing, stock, khata, backups and data export are never gated** (FR-007, US4 scenario 3); a test asserts this for every core command.
- Prices are not set here (spec assumption); payment collection is outside the app (bank transfer or UPI), recorded by the builder.

### D8. Single-shop or whole-business exit: export, then deletion

- A single shop may exit a multi-shop business (FR-008). Deliver a full export of the authorized scope as SQLite and CSV files per the export contract, then confirm receipt before deleting anything.
- On single-shop exit, disable server sync for the departing shop after confirmation so its devices cannot upload erased data again. Delete only that shop's operation log, projections (including `usage_week`), and its shop-scoped server rows that are not projections: `pilot_shop_status` (with its `note`) and `onboarding_step`. Preserve shared business records and remaining shops' data. Replace mixed snapshots and backups with versions that omit the departing shop, then retire the old copies under the retention terms in OI-1. Verify that remaining shops can still restore. A whole-business exit deletes that business's operation log, projections, `pilot_shop_status` and `onboarding_step` rows, snapshots and backups under the same terms (OI-1).
- Exiting devices keep their local data and the shop keeps its export for required records. Erasure of customers' personal data inside the shop's records remains the separate flow in 008.
- **Open item OI-1**: Shop OS acts as a processor for the shop's customer data; a processor agreement (PRD dependency "DPDP consent wording and processor contract") and the deletion and retention terms need counsel.

### D9. Builder support access is granted, time-limited and logged

`support_access_grant(business_id, requested_by` (builder), `reason`, `approved_by` (the shop's owner, on the phone app), `starts_at`, `ends_at` (default 2 hours, at most 24), `revoked_at`). While active, the builder can read that business's server data through the admin command; every read is written to the server audit log and summarised to the owner. No grant, no access (FR-009). Writing to a shop's data is never allowed through support access; fixes ship as releases or as operations the owner approves.

### D10. Problem reports reach the builder

005's problem reports sync as operations (010) with shop, user and screen tags (FR-010); the builder lists them across shops with the admin command and in the weekly review.

## Open items

| ID   | Item                                                                                                | Resolve by                     | Milestone                   |
| ---- | --------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------- |
| OI-1 | Processor agreement, deletion and retention terms for pilot shops                                   | Counsel                        | Before the first pilot shop |
| OI-2 | Plan limits and prices                                                                              | Owner, after the week-8 review | Week 8                      |
| OI-3 | Starter catalogue rows to verify with one distributor per department                                | Owner and distributors         | M2                          |
| OI-4 | Whether WhatsApp Business Platform messaging is needed for pilot shops' reminders (004 D7 fallback) | Pilot feedback                 | Week 4                      |

## References

- PostgreSQL row-level security: https://www.postgresql.org/docs/16/ddl-rowsecurity.html (primary).
- OWASP Multi-Tenant Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html (primary).
- Digital Personal Data Protection Act 2023, section 8 (duties of a data fiduciary using a processor): https://www.meity.gov.in/data-protection-framework (primary).
- Industry practice: Shopify keeps each merchant's store isolated and lets a store's staff grant collaborator access to partners with set permissions that the merchant can revoke (https://help.shopify.com/en/manual/your-account/users/collaborator-accounts, primary vendor documentation). GitHub's support staff access to private repositories requires the customer's consent and is logged (https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement, primary vendor documentation). Slack's Enterprise Key Management gives per-customer keys (https://slack.com/enterprise-key-management, primary vendor marketing). D7's "never block billing" follows the PRD, not a named company.
