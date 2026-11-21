# Implementation Plan: Cross-Cutting Quality Requirements

**Branch**: `016-quality-nfr` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-quality-nfr/spec.md`, PRD sections 12 and 15, the architecture reference sections 2, 5.8 and 12, the constitution v2.1.0 (release and test-first rules), and the plans of 001, 002, 005, 010, 012, 014, 015, 017 and 018.

## Summary

Build the routine that measures every quality promise before each shop release, early, so every feature is measured from its first commit. A seeded generator makes realistic, messy datasets at release size and at the PRD's 10-year scale through the app's own repositories. The packaged app runs benchmarks in a bench mode on the shop's own computer against budgets kept as data. An offline routine proves bills are never lost or duplicated (crash loop, no-network run, and later 010's simulation). Every backup is test-restored automatically. Security, accessibility, print-layout and rules checks run as commands. A `release-gate` CI job and a per-version release record block any release that fails, including one with an open `bill-integrity` issue.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Existing Vitest and Playwright; one development-only addition with owner approval: `@axe-core/playwright` (OD-1). No dataset or benchmark package.

**Storage**: Results as files in `quality/`; `backup_log.verified_at` and `verify_error` in the app database.

**Testing**: The feature is test tooling; its own logic (percentiles, budget comparison, dataset determinism, backup verification) has unit tests.

**Target Platform**: The owner's counter computer (reference machine), CI runners for automated checks.

**Project Type**: desktop-app tooling plus CI (pnpm workspace; `tools/quality` dev-only package).

**Performance Goals**: Release dataset built in under 15 minutes; the release gate under 30 minutes in CI excluding the scale dataset.

**Constraints**: Bench mode never runs against the shop's real data folder; budgets are goals until measured (spec assumption); misses are recorded, not hidden.

**Scale/Scope**: 6 automated check groups, 4 manual items, about 10 measures.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle                            | How this plan satisfies it                                                                                                          | Status |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| VI. Test-first and release integrity | `bill-integrity` label blocks releases; offline and crash routine on every release                                                  | Pass   |
| Release (workflow)                   | "only after offline testing passes" is now a CI gate                                                                                | Pass   |
| Database (constraints)               | Datasets and bench copies made through repositories and the online backup API; every backup proven by a real restore, automatically | Pass   |
| Performance targets (constraints)    | Measured on the owner's machine against NFR-001 and NFR-002                                                                         | Pass   |
| Accessibility (constraints)          | Automated scan in both themes plus manual colour check                                                                              | Pass   |
| VII. Simplicity                      | No new runtime packages; one dev-only package (OD-1)                                                                                | Pass   |

Post-design re-check (2026-11-18): no violations.

## Project Structure

### Documentation (this feature)

```text
specs/016-quality-nfr/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
└── contracts/quality-commands.md
```

### Source Code (repository root)

```text
tools/quality/                 # dev-only workspace package: dataset generator, bench runner, percentiles, budget check,
                               # offline routine, PIN scan, release-record template
apps/desktop/src/main/bench/   # bench mode entry (SHOPOS_BENCH), measures through real services
apps/desktop/src/main/services/BackupService.ts  # automatic verification after each backup
apps/desktop/tests/a11y/       # axe scans per screen, both themes
apps/desktop/tests/print/      # print-layout snapshots
quality/                       # budgets.json, runs/, offline/, releases/, drills/, rules-register.md
.github/workflows/release-gate.yml
```

**Structure Decision**: Quality tooling in a dev-only package so nothing of it ships; bench mode is the only addition to the shipped app, and it refuses the real data folder.

## Milestone Plan

Window 21 December 2026 to 3 January 2027 (proposed, 002 research D16), then extended by later features (tasks.md "Extension points").

| #   | Dates                     | Milestone                                                                                                           | Exit criteria                                                        |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| M1  | 21 to 27 Dec 2026         | Dataset generator, bench mode, budgets (US1)                                                                        | Quickstart 1 on the owner's machine; OI-1 to OI-3 answered           |
| M2  | 28 Dec 2026 to 3 Jan 2027 | Offline and crash routine, backup verification, security, accessibility, print snapshots, release gate (US2 to US5) | Quickstart 2 to 6; OD-1 decided; OI-4 answered; first release record |

**Risks and fallbacks**

- Scale dataset too slow to build: build once and keep it outside the repository, rebuilt only when the schema changes.
- The owner's machine is not available for every release: benchmark on the nearest equal machine and note it; the reference machine monthly.

## Complexity Tracking

| Addition                               | Why it is needed                                                              | Simpler alternative rejected because                              |
| -------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Bench mode in the packaged app         | Budgets must be measured on the shop's hardware with real services (spec US1) | Vitest timings on a developer laptop do not represent the counter |
| `release-gate` job and release records | FR-017: failures must block the release                                       | A checklist in memory is easy to skip under time pressure         |
