# Spec Review: Shop OS (all spec folders)

**Date**: 2026-11-13
**Scope**: `specs/001-shop-os-mvp/*` (spec, plan, research, data-model, contracts, quickstart, tasks, tasks.full, checklist), `specs/002` to `016` (spec.md), `docs/reference/PRD.md`, `.specify/memory/constitution.md`, `CLAUDE.md`, and the code scaffold now in `apps/` and `packages/`.
**Lenses**: senior AI engineer (spec-driven fitness), senior staff engineer (design and delivery risk), senior PM (scope, schedule, traceability).
**Method**: read every file; checked claims against the repository (schema, migrations, scripts) and ran a script mapping PRD requirement IDs to specs.

## Verdict

- **001 (MVP)**: strong foundation, **not yet clean enough to keep coding against**. Six blockers below, all fixable in about a day of document and contract work. Code is already ahead of the documents in places.
- **002 to 016**: good first-draft specs (traceable, testable stories). They are **not development-ready**: no clarify pass, no plan, no tasks, no quality checklist, and several dependency and ownership problems.

## What is good

- Requirement traceability: 201 PRD IDs; all are cited by at least one spec (US-02 and US-04 are covered through "US-01 to 04" ranges).
- Constitution principles are enforced in code, not only in prose (append-only triggers in `apps/desktop/drizzle/0001_immutability_triggers.sql`; `financial_year` and money as integers in the schema).
- Tests-first is planned, with Vitest for rules and Playwright for flows, and each milestone has exit criteria.
- Assumptions and open items are written down instead of hidden (printer, Tally format, e-way bill, PIN reset).
- Scope control: MVP reduced to inventory and basic bill; other modules separated.

## Blockers (fix before more building)

| # | Lens | Finding | Evidence | Recommended fix |
|---|---|---|---|---|
| B1 | Staff eng | **No version control.** The project is not a git repository; code, specs and migrations have no history or rollback. Spec Kit's branch and commit helpers also need it. | `git status`: not a repository | `git init`, commit the current state, protect `main`, add the scaffold, specs and docs in separate commits |
| B2 | Staff eng | **No idempotency on `bills.save`.** A double-click, a renderer retry after a timeout or a crash-and-retry could create two bills. This violates constitution I and SC-004. | No `clientBillId` or idempotency key in `contracts/ipc-commands.md`, `data-model.md` or `schema.ts` | Draft gets a client-generated id; `bill` has a unique `client_bill_id`; `bills.save` returns the existing bill on repeat; add a test that saves the same draft twice |
| B3 | PM | **MUST requirements missing from the task list.** Spec FR-016 (list and reopen), FR-017 (cancel) and FR-018 (immutability checks) are MUST, but `tasks.md` defers list, reprint and cancel. Plan milestones M4 to M6, quickstart scenarios 5 to 7, SC-004, SC-005, SC-007 and the checklist still assume them. Until cancel exists, a wrong bill cannot be undone. | `tasks.md` lines 13 and 171; spec FR-016/017 | Decide explicitly: either re-promote US3 cancel into the MVP, or amend the spec and plan (move FR-016/017 to "post-MVP", update milestones, quickstart and success criteria) so the documents agree |
| B4 | PM / legal | **Personal data without notice or consent.** 001 stores optional customer name and phone, but consent capture (PRD FR-CMP-007, due before 13 May 2027) is owned by 008. | spec 001 FR-011; 008 FR-005 | Either drop the phone field in 001 or add a minimal notice and consent line now; record the decision in the spec |
| B5 | Staff eng | **Dependency cycles across specs.** 003 depends on 004 and 004 depends on 003 (credit sales); 003 depends on 008 and 008 depends on 003 (bill format). | Each spec's "Depends on" line | Define extension points in 001 (bill-format strategy, payment-method list) and make the dependency graph a DAG; document it in `specs/README.md` |
| B6 | Staff eng / legal | **Erasure vs immutability is unresolved.** DPDP erasure requests (008) conflict with immutable bills that carry `customer_name` and `customer_phone`; the trigger `bill_only_cancel_update` blocks any edit, so erasure is impossible by design. | `0001_immutability_triggers.sql`; spec 008 US5 | Decide now, before the schema grows: keep customer data in a separate `party` record referenced by id (erasable) and keep only legally required fields on the bill; get the CA's and counsel's view on what must remain |

## Major findings

| # | Lens | Finding | Fix |
|---|---|---|---|
| M1 | AI eng | **Documents drift from the code.** The schema has `bill.financial_year` but `data-model.md` lists it only for `number_counter`; the immutability triggers are in neither `data-model.md` nor `tasks.md`; the code and tests exist but every task checkbox is unticked; `plan.md` Constitution Check still says the constitution is the unfilled template. | Update data-model, plan and tasks to match; tick completed tasks; fill the Constitution Check with the seven principles |
| M2 | AI eng | **Two sources of truth for tasks.** `tasks.md` and `tasks.full.md` both exist with overlapping IDs (T053 to T057 mean different things in each). Spec Kit commands read `tasks.md` only. | Move `tasks.full.md` to `specs/001-shop-os-mvp/backlog/` or rename it `tasks.deferred.md` with new IDs |
| M3 | Staff eng | **Time semantics undefined.** `bill_date` is "local" while other timestamps are UTC; financial year, same-day edit and day-close depend on the timezone and on a correct device clock (EC-20). | State Asia/Kolkata as the business timezone, store UTC plus the local date, and test the 31 March and 1 April boundary |
| M4 | Staff eng | **Rounding rules incomplete.** Only percent-discount rounding is specified; line amount rounding (quantity in thousandths times rate), where the bill-level percent applies, and remainder handling are not. | Write one rounding section in `research.md` D5 and mirror it in `billing.test.ts` |
| M5 | Staff eng | **Missing operational design for 001.** No upgrade and migration policy (back up before migrating), no behaviour for a corrupt database or a full disk, no logging or diagnostics policy, no crash reporting rule (privacy). | Add an "Operations" section to the plan: backup-before-migrate, integrity check on start, disk-space check, local log file without personal data |
| M6 | Staff eng | **IPC contract is thin.** No enumeration of generic errors (validation, internal), no pagination limits, no `items.get`, no contract version, no timeouts. | Extend `contracts/ipc-commands.md`; generate the Zod schemas from it |
| M7 | Staff eng | **No CI or quality gates in the plan.** Lint, typecheck, unit, integration and a packaged-app smoke test are not tied to a pipeline; the constitution's definition of done cannot be enforced. | Add a CI task (even a local `pnpm verify` script) and make it a gate in each milestone |
| M8 | PM | **Schedule has no estimates or slip policy.** 63 tasks across 12 weeks for one builder, with the known time sinks (printing, native module packaging) inside a 1-week spike. Owner decisions (printer model, bill number format) are due 6 Dec with no owner follow-up. | Add task estimates or t-shirt sizes, a weekly review, an explicit cut line (what moves out first), and dated owner decisions |
| M9 | AI eng | **002 to 016 mix releases inside one spec.** P1 MVP stories sit with `[V2]`, `[V3]` and `[Later]` requirements, so none of them is a shippable unit. | Keep the PRD release tags, but add an "In scope for this iteration" section per spec and plan only that part first |
| M10 | PM | **No single owner per requirement.** FR-BIL-022 appears in 003, 006 and 008; import appears in 001, 002 and 012; approvals in 003, 005 and 007. | Create `docs/reference/traceability.md`: one row per PRD ID with its owning spec and any referencing specs |
| M11 | AI eng | **No clarification markers or checklists for 002 to 016.** Real open questions exist (PIN reset, Tally format, e-way bill, Legal Metrology on tinting) but are only in Assumptions, so `/speckit-clarify` has nothing to find; `checklists/requirements.md` exists only for 001 and is now stale. | Convert up to 3 critical unknowns per spec into clarification items; generate a quality checklist per spec |
| M12 | AI eng | **016 specifies by reference.** FR-012 and FR-013 only point to other specs, so they are not testable on their own. | Restate the measurable criteria or remove those two requirements |
| M13 | Staff eng | **The architecture reference is missing from the repo** though `CLAUDE.md` and the constitution cite it and 010 depends on it. | Export the doc to `docs/reference/architecture.md` (the connector was unavailable) |
| M14 | Staff eng | **No access control in 001 is an unstated risk.** Anyone at the counter can cancel, adjust stock or change settings until 005. | State it as an accepted risk with a mitigation (operating-system login, owner supervision) and a date when 005 lands |

## Minor findings

- Spec 001, US2 scenario 8: "credit-note-free 'unpaid'" is confusing; list the four labels (cash, UPI, card, unpaid).
- The 16-character bill-number limit appears in the constitution and tasks but not in spec FR-013.
- Search budgets differ: 001 SC-003 is 0.5 s at 5,000 items; the PRD's NFR-001 is about 0.2 s at 50,000. State both and which applies when.
- `requirements.md` checklist says all items pass; it predates the scope change and later edits.
- Requirement numbering restarts at FR-001 in every spec, which collides visually with PRD IDs; consider `FR-003-012` style.
- 013 and 010 will need a threat model and a data-protection impact note before planning.

## Recommended order of fixes

1. **Today**: B1 (git), then B3 (decide the cancel and list scope), B2 (idempotency), B4 and B6 (customer data decision).
2. **This week**: M1, M2, M3, M4, M6 (bring documents and contract into line with the code), M13.
3. **Before planning 002 to 016**: B5, M9, M10, M11, then `/speckit-clarify` per spec.
4. **Before go-live**: M5, M7, M8, M14 resolved in the plan.

## Open questions for the owner

1. Is cancel and bill list in or out of the first release? (B3)
2. Do you want customer phone captured in the first release, and if so with what notice? (B4)
3. Should customer data live on a separate record so erasure is possible? (B6)
4. What are the printer model and the bill-number format, and by what date will you decide? (M8)


## Status update (2026-11-14)

| # | Finding | Status |
|---|---|---|
| B1 | No version control | Done: git initialised, baseline commit `0cb2c24`; later changes are uncommitted |
| B2 | No idempotency on `bills.save` | Done: required `clientBillId`, unique `client_bill_id` (migration 0003), trigger protects it, 3 new tests; contract, data model, spec FR-013a and plan updated |
| B3 | MUST requirements missing from tasks | Decided: cancel and bill list are IN the first release. `tasks.md` Phase 6 (T064 to T072) added; code not built yet |
| B4 | Personal data without consent | Decided: customer phone dropped, name only. Removed from schema (migration 0002), contract, UI, tests and spec FR-011 |
| B5 | Dependency cycles across specs | Open |
| B6 | Erasure vs immutability | Partly addressed: no contact details are stored now; the customer name on a saved bill still cannot be erased. Separate erasable party record is for features 004 and 008 |
| M1 | Documents drift | Partly done: data-model (financial year, triggers, rounding, time), plan Constitution Check updated; another session is ticking tasks.md |
| M2 | Two task files | Open |
| M3 | Time zone | Documented as open item; not fixed in code |
| M4 | Rounding | Documented in data-model from the code |
| M5 | Operations design | Proposed in research D15; not built |
| M14 | No access control in 001 | Documented as accepted risk (research D16) |
| M6, M7, M8, M9 to M13 | IPC contract depth, CI, estimates, release split, traceability, clarify markers, 016 wording, architecture export | Open |
| Naming | Single-letter names | Done: 339 renamed, lint rule enforced, constitution v1.1.0 |
