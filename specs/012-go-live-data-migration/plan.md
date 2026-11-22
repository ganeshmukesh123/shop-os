# Implementation Plan: Go-Live, Data Migration and Release Practice

**Branch**: `012-go-live-data-migration` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-go-live-data-migration/spec.md`, PRD sections 1, 3 and 15, the constitution v2.1.0 (release and trial rules), 001's plan and restore guide, and the designs of 002, 004, 005, 007 and 010.

## Summary

Mostly procedure, with small tools. A readiness check over what is loaded (reusing 002's item import and merge and 004's party import); a training mode on a separate copy of the database so practice never touches real stock, ledgers or numbers; a settings sign-off list and training records with a champion; evening reconciliation against the old book with the share of sales billed in the system and bypass warnings; paper bills back-filled under their own paper numbers; top-200 accuracy from rack counts; gate reviews; feature switches with a walkthrough record; and a release practice with a real rollback path (additive migrations and a labelled pre-upgrade backup).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Unchanged; no new package.

**Storage**: Same SQLite file plus `training.sqlite`. New `readiness_input`, `signoff_item`, `training_record`, `daily_reconciliation`, `gate_review`, `feature_switch`, `release_marker`; `bill.paper_bill_ref`; `number_series.doc_kind` value `paper_backfill`.

**Testing**: Vitest test-first for readiness, share, accuracy and the back-fill bill write; an integration test that training mode never writes the real file; a two-build rollback test (OI-2); Playwright for the quickstart.

**Target Platform**: macOS first; Windows and Linux.

**Project Type**: desktop-app (pnpm workspace) plus operations documents.

**Performance Goals**: Readiness under 2 s at 50,000 items; entering and leaving training mode under 10 s.

**Constraints**: Training never touches live data; back-fill never issues a second invoice number; rollback never loses a bill silently.

**Scale/Scope**: 3 to 8 staff (OI-3); 6 small screens (readiness, sign-off, training, reconciliation, gates and accuracy, feature switches).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle              | How this plan satisfies it                                                                                                        | Status                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| I. Saved bill versions | Back-filled bills are ordinary saved bills under their paper numbers; training bills live only in the training file               | Pass                     |
| II. Immutable records  | Reconciliation and gate reviews append-only; opening-balance changes after go-live by adjustment (004)                            | Pass                     |
| III. Integers          | Paise                                                                                                                             | Pass                     |
| IV. Offline-first      | Everything local; training disables sync                                                                                          | Pass                     |
| V. UI-free core        | Readiness, share, bypass and accuracy rules in core                                                                               | Pass                     |
| VI. Test-first         | Back-fill and training isolation tested first                                                                                     | Pass                     |
| VII. Simplicity        | Reuses 002 and 004 imports; switches are a settings list                                                                          | Pass                     |
| Release (workflow)     | Every 2 weeks, offline tests, previous version installable, features on after a walkthrough; rollback path defined (research D10) | Pass once OI-2 is tested |
| Milestones and trial   | Gates and the parallel run measure the success criteria at the counter                                                            | Pass                     |
| Database (constraints) | Training copy and pre-upgrade backups made with the online backup API                                                             | Pass                     |

Post-design re-check (2026-11-18): no violations.

## Project Structure

### Documentation (this feature)

```text
specs/012-go-live-data-migration/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
└── contracts/ipc-commands.md
docs/operations/
├── go-live-runbook.md       # the PRD go-live table as a checklist (below)
└── release-checklist.md     # research D10
```

### Source Code (repository root)

```text
packages/core/src/golive/     # readiness.ts, shareBilled.ts, bypassSignals.ts, top200Accuracy.ts, trainingSeries.ts
apps/desktop/src/main/
├── golive/                   # ReadinessService, TrainingModeService (copy, switch connection), ReconciliationService,
│                             # GateService, FeatureSwitchService, ReleaseMarker
├── services/billing/         # BackfillPaperBill use case
└── ipc/handlers.ts
apps/desktop/src/renderer/features/golive/
├── Readiness/, Signoff/, Training/ (TrainingBanner/), Reconciliation/, Gates/, FeatureSwitches/
```

**Structure Decision**: Same two packages; operations documents in `docs/operations/` next to 010's runbook.

## Go-live runbook (PRD section 15, dated against go-live day G)

| When           | Step                                                           | Done when                                                                         | Tool                                      |
| -------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------- |
| G - 14 days    | Import items, parties, opening balances; clean duplicates      | No import gaps; SC-002 date recorded                                              | Readiness, 002 and 004 imports, 002 merge |
| G - 7 days     | Set tiers, roles, limits, MRP, paint classes; print shelf tags | Sign-off complete                                                                 | Sign-off list, 002 labels                 |
| G - 7 to G - 1 | Train each staff member (2 x 1 hour); name a champion          | Both sessions and 5 unaided bills each, champion named; overall readiness "Ready" | Training mode and records                 |
| Week 1         | Bill in Shop OS; old book for credit only; evening total check | Totals match daily (SC-004)                                                       | Reconciliation                            |
| Weeks 1 to 4   | Count one rack a day                                           | Top-200 accuracy measured                                                         | 007 counts, accuracy                      |
| Week 2         | Stop old billing; owner reviews day close and approvals daily  | No bills outside the system                                                       | Share billed, bypass view                 |
| Week 4         | Gate 1; fix top 3 complaints before new features               | Gate 1 passed                                                                     | Gates                                     |
| Day 60         | Accuracy check                                                 | 95% (SC-005)                                                                      | Accuracy                                  |

Fallback (PRD): a second device or the owner's phone bills offline; the paper bill book stays in the drawer for the first month and is back-filled the same day.

## Milestone Plan

Window 23 August to 12 September 2027 (proposed, 002 research D16), then the runbook from G.

| #       | Dates                                                                    | Milestone                                                               | Exit criteria                                              |
| ------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| M1      | 23 to 29 Aug                                                             | Readiness, clean-up loop, feature switches, release practice (US1, US5) | Quickstart 1 and 5; OI-2 tested; release checklist written |
| M2      | 30 Aug to 5 Sep                                                          | Training mode, sign-off, training records (US2)                         | Quickstart 2; OI-3 answered                                |
| M3      | 6 to 12 Sep                                                              | Reconciliation, paper back-fill, bypass, accuracy, gates (US3, US4)     | Quickstart 3, 4 and 6; OI-1 and OI-4 answered              |
| Go-live | G (about 1 October 2027 on the full-MVP calendar; see 002 research OD-4) | Runbook                                                                 | SC-001 to SC-006 measured over the first 60 days           |

**Risks and fallbacks**

- The owner's books are not in spreadsheets: 004's manual opening-balance screen; the readiness check counts parties loaded either way.
- Staff bypass in rush hours (PRD high risk): the share and bypass views reviewed daily by the owner; the champion helps at the counter.
- A release must be rolled back with a non-additive migration: follow the preservation and reconciliation gate in research D10 before restoring; the release checklist forbids non-additive migrations in the first 60 days.

## Complexity Tracking

| Addition                                      | Why it is needed                                    | Simpler alternative rejected because                                  |
| --------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| Separate training database file               | Training must not touch live data (US2 scenario 1)  | A training flag on live rows risks one missed filter corrupting stock |
| Paper back-fill series using the paper number | No second invoice number for one sale (research D6) | Re-entering as a normal bill issues two numbers for one sale          |
