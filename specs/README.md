# Shop OS feature specs

One folder per feature. Order is a proposal; dependencies are listed in each spec. Requirements come from `docs/reference/PRD.md`.

| # | Feature | PRD areas | Status |
|---|---|---|---|
| 001 | [MVP: inventory and basic bill](001-shop-os-mvp/spec.md) | ITM and BIL basics | spec, plan, tasks written; not built |
| 002 | [Items: variants and tinting](002-items-variants-tinting/spec.md) | ITM, TNT | spec written |
| 003 | [Advanced billing](003-advanced-billing/spec.md) | BIL | spec written |
| 004 | [Parties and khata](004-parties-khata/spec.md) | KHA | spec written |
| 005 | [Roles, approvals, audit, day-close](005-roles-approvals-audit/spec.md) | CTL | spec written |
| 006 | [Delivery](006-delivery/spec.md) | DLV | spec written |
| 007 | [Stock locations, counts, rolls](007-stock-locations-rolls/spec.md) | STK | spec written |
| 008 | [GST and compliance](008-gst-compliance/spec.md) | CMP | spec written |
| 009 | [Purchases and warranty](009-purchases-warranty/spec.md) | PUR | spec written |
| 010 | [Owner app, godown app, sync, backup](010-owner-app-sync/spec.md) | OWN, NFR | spec written |
| 011 | [Reports, expenses, CA export](011-reports-expenses-export/spec.md) | RPT, CMP-004 | spec written |
| 012 | [Go-live, data migration, release practice](012-go-live-data-migration/spec.md) | Sections 1, 3, 15 | spec written |
| 013 | [Pilot shops, multi-shop, paid plans](013-pilot-multi-shop-plans/spec.md) | Sections 1, 2, 15, BO-6 | spec written |
| 014 | [Languages and localization](014-languages-localization/spec.md) | NFR-012, ITM-006, KHA-007 | spec written |
| 015 | [Devices, printing, scanning](015-devices-printing-scanning/spec.md) | NFR-013, BIL-015, ITM-013 | spec written |
| 016 | [Cross-cutting quality requirements](016-quality-nfr/spec.md) | NFR-001 to 016 | spec written |

## Dependency sketch

- 001 first. 002 and 005 build directly on it.
- 003 needs 002, 004 and 005 for tiers, credit and approvals; it can start earlier with the parts that do not.
- 004 needs 001 and 005. 006 needs 003, 004, 005. 007 needs 002 and 005. 008 needs 002, 003, 004.
- 009 needs 002, 004, 007, 008. 010 needs the counter features before sync is useful. 011 needs data from most others.

- 012 applies from the first trial of 001 and grows with the full MVP go-live. 013 needs 010 and a passed Gate 3. 014 and 015 start in 001 (text separation, first print test) and extend later. 016 applies to every feature as the release check.

## Next for each spec

Each still needs `/speckit-clarify`, `/speckit-plan` and `/speckit-tasks` when it is scheduled. Only 001 has a plan and tasks.
