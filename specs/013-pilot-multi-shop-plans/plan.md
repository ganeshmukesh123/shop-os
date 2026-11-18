# Implementation Plan: Pilot with Other Shops, Multi-Shop Separation and Paid Plans

**Branch**: `013-pilot-multi-shop-plans` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-pilot-multi-shop-plans/spec.md`, PRD sections 1, 2, 3 and 15, the architecture reference sections 3, 6.10, 8.1 and 12.3 to 12.5, the constitution v2.1.0, and the designs of 008, 010, 011 and 012.

## Summary

Prove and enforce that one business never sees another's data: master data scoped to the business, facts and settings to the shop, pull filtered by both, and an automated cross-tenant test suite on the server and the desktop as a required check. Let the builder create pilot businesses and shops from an audited admin command, onboard each with 012's tools and starter import templates, review weekly usage from aggregates only, record plan offers and subscriptions with signed entitlements that pause premium features but never billing, backups or export, grant time-limited, owner-approved, logged support access, and handle a shop leaving with a full export and server deletion.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: 010's server stack; no new package.

**Storage**: Server PostgreSQL: `pilot_shop_status`, `onboarding_step`, `usage_week`, `plan`, `subscription`, `plan_offer`, `entitlement_issue`, `support_access_grant`, `business_exit`. Device: `entitlement_cache`. Starter CSV files in `catalogue/starters/`.

**Testing**: Cross-tenant suites (server routes, row-level security, desktop commands with two shops); entitlement tests asserting core commands are never gated; Vitest test-first for retention and scope rules.

**Target Platform**: Server (Linux VM), desktop, owner phone.

**Project Type**: web-service + desktop-app + mobile-app (from 010).

**Performance Goals**: Weekly usage for 10 shops under 5 s; pull filtering adds no measurable time (indexed by `business_id`, `shop_id`, `server_seq`).

**Constraints**: Zero cross-tenant records (SC-001); billing never gated; aggregates only in usage; builder access only by grant.

**Scale/Scope**: 10 pilot shops, then up to about 100 on the same server (architecture 13.1 "growth" stage needs a read replica, not part of this plan).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle           | How this plan satisfies it                                                                                                                 | Status          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| I to III            | No change to bills, records or money rules                                                                                                 | Pass            |
| IV. Offline-first   | Entitlements cached with a 14-day grace; billing never needs them                                                                          | Pass            |
| V. UI-free core     | Scope, retention and entitlement rules in core                                                                                             | Pass            |
| VI. Test-first      | Tenancy and entitlement tests first                                                                                                        | Pass            |
| VII. Simplicity     | Admin CLI instead of a console; import templates instead of a pack engine (research D5)                                                    | Pass            |
| Privacy and records | Aggregates only for usage; support access granted, time-limited and logged; exit export then deletion; processor terms with counsel (OI-1) | Pass (recorded) |

Post-design re-check (2026-11-18): no violations.

## Project Structure

### Documentation (this feature)

```text
specs/013-pilot-multi-shop-plans/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
└── contracts/admin-and-api.md
```

### Source Code (repository root)

```text
packages/core/src/tenancy/      # recordScope.ts, retention.ts, entitlement.ts, alwaysFree.ts
apps/server/src/
├── admin/                      # CLI commands (create-business, create-shop, pilot, usage, plans, offer, support, reports, exit)
├── modules/tenancy/            # scope filters for pull, tenant tests helpers
├── modules/plans/              # plans, subscriptions, offers, entitlement issuing
├── modules/support/            # access grants, audited reads
├── modules/usage/              # weekly usage projection
└── tests/tenancy/              # cross-tenant suite
apps/desktop/src/main/
├── entitlement/                # cache, check in 012's FeatureSwitchService
├── exports/exportAll.ts        # full export
└── tests/tenancy/              # two-shop device suite
apps/mobile/src/owner/SupportRequests/
catalogue/starters/             # electrical.csv, plumbing.csv, paint.csv, tools.csv, hardware.csv
```

**Structure Decision**: Server-side additions live in new modules of 010's server; the desktop gets small additions only.

## Milestone Plan

Window 6 March to 2 April 2028 (after Gate 3; 002 research D16), then an 8-week pilot.

| #     | Dates                       | Milestone                                                         | Exit criteria                                                |
| ----- | --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| M1    | 6 to 12 Mar                 | Separation and the cross-tenant suite (US1)                       | Quickstart 1; SC-001 as a required CI check                  |
| M2    | 13 to 19 Mar                | Admin commands, onboarding tracking, starter templates (US2)      | Quickstart 2; OI-3 started                                   |
| M3    | 20 to 26 Mar                | Usage review and retention (US3), problem reports, support access | Quickstart 3 and 5                                           |
| M4    | 27 Mar to 2 Apr             | Plans, entitlements, exit (US4)                                   | Quickstart 4; OI-1 answered by counsel before the first shop |
| Pilot | 8 weeks from the first shop | 10 shops                                                          | SC-002 to SC-005                                             |

**Risks and fallbacks**

- A tenancy bug is found during the pilot: the pilot pauses until the suite covers it; data is never merged by hand.
- Pilot shops want features not in the PRD: logged to the backlog, not built during the pilot (spec edge case).

## Complexity Tracking

| Addition                                | Why it is needed                                        | Simpler alternative rejected because                             |
| --------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| Signed entitlements with a grace period | Plans without blocking offline billing (FR-007)         | An online plan check would stop billing offline                  |
| Support access grants                   | Builder access must be logged and time-limited (FR-009) | Standing admin access to every shop breaks trust and DPDP duties |
