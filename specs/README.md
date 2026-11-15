# Shop OS feature specs

One folder per feature. Order is a proposal; dependencies are listed in each spec. Requirements come from `docs/reference/PRD.md`.

| # | Feature | PRD areas | Status |
|---|---|---|---|
| 001 | [MVP: inventory and basic bill](001-shop-os-mvp/spec.md) | ITM and BIL basics | US1 and US2 built and tested; US3 (bill list, cancel), the schema move and the 2026-11-15 decisions (tasks Phase 7) not built; real printer and packaged app not verified |
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
| 017 | [GitHub workflow: CI and merge protection](017-ci-github-workflow/spec.md) | Constitution VI, PR rules | spec, plan, research, tasks written; packages installed; baseline measured |
| 018 | [Electron hardening: security and performance](018-electron-hardening/spec.md) | NFR-008, NFR-002, NFR-007 | later feature; spec and research written (2026-11-15); no code |

## Dependency Architecture (Strict DAG)

To prevent circular dependencies, features are structured into a strict Directed Acyclic Graph (DAG) across layers:

- **Layer 0 (Gates & Quality)**: `017` (CI & merge protection) gates all merges. `016` (Quality benchmarks) enforces speed, offline, and reliability checks across all releases.
- **Layer 1 (Core Foundation)**: `001` (MVP: inventory, immutable movements, basic bill, local SQLite).
- **Layer 2 (Domain Extensions)**: 
  - `002` (Items: families, variants, tinting) depends on `001`.
  - `005` (Roles, PINs, approvals, day-close) depends on `001`.
  - `014` (Localization) and `015` (Hardware devices) extend `001`.
- **Layer 3 (Ledgers & Tracking)**: 
  - `004` (Parties and khata credit ledger) depends on `001` and `005`.
  - `007` (Stock locations, rack counts, roll cutting) depends on `001`, `002`, and `005`.
- **Layer 4 (Counter Workflows & Tax)**: 
  - `003` (Advanced billing: tiers, credit sales, split payments, returns) depends on `001`, `002`, `004`, and `005`.
  - `006` (Delivery: challans, driver cash) depends on `003`, `004`, and `005`. Its phone proof of delivery is an optional later step that waits for `010`; until then proof is entered at the counter, so `006` does not depend on `010`.
  - `008` (GST compliance & scheme switching) depends on `001`, `002`, `003`, and `004`.
- **Layer 5 (Supply Chain & Reporting)**: 
  - `009` (Purchases, landed cost, warranty) depends on `002`, `004`, `007`, and `008`.
  - `011` (Reports, expenses, CA export) depends on `001`, `004`, `005`, `007`, `008`, and `009`.
- **Layer 6 (Multi-Device & Scale)**: 
  - `010` (Owner app, godown app, sync hub) depends on counter features `001`–`009`.
  - `012` (Data migration) accompanies go-live gates and now owns spreadsheet item import (PRD FR-ITM-012), moved out of `001` on 2026-11-15.
  - `013` (Multi-shop & paid pilot) depends on `010` after Gate 3.

## Next for each spec

Each feature proceeds through the Spec Kit workflow when scheduled: `/speckit-clarify` → `/speckit-checklist` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`. Currently, `001` and `017` have plans and tasks.
