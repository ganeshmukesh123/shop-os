---
description: "Task list for feature 013: multi-shop separation, pilot onboarding, usage, plans, support access"
---

# Tasks: Pilot with Other Shops, Multi-Shop Separation and Paid Plans

**Input**: Design documents from `/specs/013-pilot-multi-shop-plans/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/admin-and-api.md, quickstart.md. Features 010, 011 and 012 merged; Gate 3 passed.

**Tests**: Included and written first (tenant isolation protects every record; entitlements must never gate billing).

**Organization**: US1, US2, US3 (P1), US4 (P2), plus support access and exit (FR-008, FR-009).

## Format: `[ID] [P?] [Story] Description`

`core` = `packages/core`, `server` = `apps/server`, `desktop` = `apps/desktop`, `mobile` = `apps/mobile`.

---

## Phase 1: Setup

- [ ] T001 Ask counsel OI-1 (processor agreement, deletion and retention terms); record in `specs/013-pilot-multi-shop-plans/research.md`; no pilot shop starts before the answer
- [ ] T002 [P] Create `core/src/tenancy/` with a barrel exported from `core/src/index.ts`, and `server/src/admin/` with a CLI entry and an audit hook

---

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:efe2225c47b4f330a65ff1296cb2d418d4c1b76322d056246a465df23f8c17d0 -->

## Phase 2: Foundational

- [ ] T003 [P] Write tests in `core/tests/tenancy/recordScope.test.ts`: enumerate both schemas and require every table to be classified as business, shop or explicitly global, as defined in `data-model.md`; a new unclassified table fails the test, and global `plan` rows never enter tenant pull
- [ ] T004 [P] Write tests in `core/tests/tenancy/entitlement.test.ts` and `alwaysFree.test.ts`: grace of 14 days after expiry; billing, stock, khata, backup and export commands always allowed whatever the entitlement
- [ ] T005 Implement `core/src/tenancy/*.ts` to pass T003 and T004

---

## Phase 3: User Story 1 - Separate businesses and shops (M1, 6 to 12 Mar 2028; P1)

- [ ] T006 [P] [US1] Write the server suite `server/tests/tenancy/routes.test.ts`: for every route, business B's token with business A's ids returns 404; snapshot and backup links only for the token's business
- [ ] T007 [P] [US1] Write `server/tests/tenancy/rls.test.ts`: every server query run with B's tenant setting returns none of A's rows; a query with no tenant setting returns nothing
- [ ] T008 [P] [US1] Write `desktop/tests/tenancy/twoShops.test.ts`: a database with shops A1 and A2 of one business; every list, report and export command scoped to A1 returns no A2 facts; master data is shared
- [ ] T009 [US1] Filter pull by business for master data and by shop for facts and settings in `server/src/modules/tenancy/pullScope.ts` using `recordScope`; exclude global tables from tenant pull, to pass T003, T006 and T007
- [ ] T010 [US1] Add shop predicates where T008 finds leaks in `desktop/src/main/repositories/` and the report queries
- [ ] T032 [P] [US1] Test per-business cloud backup keys (FR-001, SC-001): A and B use distinct keys; B cannot decrypt A's backup; restore A using A's authorized key and verify all A rows and no B rows
- [ ] T033 [US1] Implement per-business key provisioning and authorized key selection for cloud backup and restore in 010's backup module (FR-001); pass T032
- [ ] T011 [US1] Make the isolation suites and backup key tests a required check in `.github/workflows/` and record SC-001

---

<!-- /coderabbit-ai-generated:v1 -->

## Phase 4: User Story 2 - Onboard a pilot shop (M2, 13 to 19 Mar; P1)

- [ ] T012 [P] [US2] Write tests in `server/src/admin/createShop.test.ts`: `create-business` and `create-shop` write audit rows; the shop gets default per-shop settings and an owner registration code
- [ ] T013 [US2] Implement `server/src/admin/` commands `create-business`, `create-shop`, `pilot add` to pass T012
- [ ] T014 [US2] Emit onboarding steps as operations from 012's readiness, sign-off, training and the first real bill in `desktop/src/main/golive/`, and store them in `onboarding_step` on the server, with tests
- [ ] T015 [P] [US2] Write `catalogue/starters/electrical.csv`, `plumbing.csv`, `paint.csv`, `tools.csv`, `hardware.csv` from architecture section 6.11 with an `unverified` column set on every row and HSN left blank; test that each imports through 002's preview without errors
- [ ] T016 [US2] Add `admin reports` listing synced problem reports with shop, user and screen
- [ ] T017 [US2] Onboard a test shop from empty to first real bill (quickstart 2) and record the time (SC-002)

---

## Phase 5: User Story 3 - Usage review and retention (M3, 20 to 23 Mar; P1)

- [ ] T018 [P] [US3] Write tests in `core/tests/tenancy/retention.test.ts` and `server/src/modules/usage/usageWeek.test.ts`: active days, bills, sales, share billed and overdue from operations; no party names, phones or lines in the output; retention at week 8 against 7 of 10
- [ ] T019 [US3] Implement `core/src/tenancy/retention.ts`, `server/src/modules/usage/` and `admin usage` to pass T018
- [ ] T020 [US3] Run quickstart 3 with generated activity for 10 shops

---

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ff3ab8e7880a618ca301ef1912fce46ad6d6bd65d9caf6716d0aa84ccefeb67c -->

## Phase 6: Support access and exit (M3, 24 to 26 Mar; FR-008, FR-009)

- [ ] T021 [P] Write tests in `server/src/modules/support/grants.test.ts`: request, owner approval, reads allowed only inside `starts_at` to `ends_at` (at most 24 hours), every read audited, revoke stops reads, no write path exists
- [ ] T022 Implement `server/src/modules/support/`, `admin support request` and `support read`, and `mobile/src/owner/SupportRequests/` to pass T021
- [ ] T023 [P] Write tests in `desktop/src/main/exports/exportAll.test.ts`: with A1 and A2 in the source, reopen the SQLite export and check it and the CSVs contain every authorized A1 row and shared master row and no A2 facts or settings; verify a whole-business export preserves committed WAL data through online backup, permission is required, and plan lapse does not block export (FR-008)
- [ ] T024 Implement scoped `exportAll.ts` and `POST /v1/owner/export` per the contract, plus `admin exit start` and `exit delete-server-data` per D8. Test that deletion waits for confirmation of the matching scope, and that A2 can still sync and restore after A1 exits (quickstart 5.2, FR-008)

---

<!-- /coderabbit-ai-generated:v1 -->

## Phase 7: User Story 4 - Paid plans and willingness to pay (M4, 27 Mar to 2 Apr; P2)

- [ ] T025 [P] [US4] Write tests in `server/src/modules/plans/plans.test.ts`: plans, subscriptions, offers and decisions; entitlement JWT lists premium features with expiry and grace
- [ ] T026 [US4] Implement `server/src/modules/plans/`, `GET /v1/entitlement` and `admin plans`, `subscribe`, `offer` to pass T025
- [ ] T027 [US4] Implement `desktop/src/main/entitlement/` (cache, refresh on sync, check in 012's `FeatureSwitchService` for premium features only) with a test that every command in `isAlwaysFree` works with a lapsed entitlement
- [ ] T028 [US4] Run quickstart 4; record acceptances against SC-004 at week 8

---

## Phase 8: Polish

- [ ] T029 [P] Check new desktop and phone screens in light and dark
- [ ] T030 Write the pilot onboarding guide in `docs/operations/pilot-onboarding.md` (visit checklist, WhatsApp support group rules, weekly review)
- [ ] T031 Run all checks, including the tenancy suites

---

## Dependencies and execution order

```
Setup --> Foundational --> US1 (separation) --> US2 --> US3 --> support and exit --> US4 --> Polish --> pilot
```

No pilot shop starts before US1's suite passes and OI-1 is answered.

## Parallel examples

- US1: T006, T007, T008 together.
- Phase 6: T021 and T023 together.

## Implementation strategy

Separation first and proven by tests; then the smallest tools that let the builder run 10 shops by hand; plans last, because prices come from the pilot.
