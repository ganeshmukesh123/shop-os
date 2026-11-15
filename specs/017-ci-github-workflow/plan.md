# Implementation Plan: GitHub Workflow (CI and merge protection)

**Branch**: `017-ci-github-workflow` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-ci-github-workflow/spec.md` (decisions Q1 to Q3 recorded 2026-11-14).

## Summary

Add a GitHub Actions pipeline that runs formatting, lint, types, tests with coverage, the build and the end-to-end tests on every pull request, and protect `main` so nothing merges unless every required check is green. Coverage must be at least 90% on everything (core, main process, React renderer), enforced from day one **of the gate**, which is switched on only after the project reaches 90%. The pipeline starts in report-only mode, the project then climbs to 90% in small PRs, and finally the gate and branch protection are turned on.

```
 PR ──► [1 quick] ──► [2 tests + coverage] ──► [3 build] ──► [4 e2e] ──► required checks
        format         vitest in Electron's     electron-      Playwright    all green?
        lint           Node, v8 coverage        vite           under xvfb     -> mergeable
        types          >= 90% (when gate ON)
        migrations
        PR title/size
```

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (from `.nvmrc`), workflow YAML

**Primary Dependencies**: GitHub Actions (hosted runners), pnpm (version from `package.json` `packageManager`), Vitest ^4.1.12 with `@vitest/coverage-v8@4.1.12` (upgraded from 2.1.9 on 2026-11-14, research F9), `@testing-library/react`, `@testing-library/user-event`, `jsdom`, Playwright for Electron

**Storage**: N/A (artifacts: coverage report, e2e traces)

**Testing**: the existing `pnpm test` (Electron's Node), `pnpm build`, `pnpm test:e2e`; new `pnpm test:coverage`

**Target Platform**: Linux runners for required checks; macOS and Windows for post-merge and nightly smoke tests

**Project Type**: CI configuration plus test and coverage setup in the existing monorepo

**Performance Goals**: required checks about 10 minutes or less on a warm cache

**Constraints**: solo developer (no required reviewers); the SQLite binary must be the Electron build everywhere (`ensure-electron-sqlite`); no secrets exposed to fork PRs; each PR within 400 lines (plan below respects this)

**Scale/Scope**: about 10 workflow jobs and scripts, about 15 test files for the main process, about 20 renderer test files, and refactors of the large screens so they can be tested

## Constitution Check

| Principle | How this plan satisfies it | Status |
|---|---|---|
| I, II (never lose or alter a bill; immutable records) | The gate stops changes that break these rules (their tests are required checks) | Pass |
| VI (test-first, no known defect) | CI makes "tests pass" automatic; 90% coverage keeps new code tested | Pass |
| VII (simplicity) | Reuse existing commands; one coverage config module; no custom CI framework | Pass |
| VIII, IX (names, small pure code) | Quick-checks step runs lint (no single-letter names, no `continue`, size limits as warnings); scripts follow the same rules | Pass |
| X (design) | Renderer tests also run in the design's light and dark themes where theming changes behaviour (later) | Pass |
| Dev workflow: PR size and template | Size and title checks added to quick checks; this plan's own PRs are split to 400 lines | Pass |
| New packages need approval | Approved 2026-11-14: coverage provider and component-test tools | Pass |

## Project Structure

### Documentation

```text
specs/017-ci-github-workflow/
├── spec.md   plan.md   research.md   tasks.md
```

### Source (new and changed files)

```text
.github/
├── workflows/
│   ├── ci.yml              quick checks, tests + coverage, build, e2e (required)
│   └── smoke.yml           macOS + Windows packaged-app smoke (post-merge, nightly)
├── pull_request_template.md   (exists)
└── dependabot.yml          optional dependency updates

config/
└── coverage.ts             threshold (90), exclusions, COVERAGE_ENFORCE switch

scripts/
├── pr-size.sh              (exists)
└── ci/
    ├── check-migrations.sh      regenerate migrations; fail if anything changes
    ├── check-pr-title.mjs       type(scope): summary
    └── coverage-summary.mjs     merge json-summary files into a markdown table

packages/core/vitest.config.ts       coverage config
apps/desktop/vitest.config.ts        coverage config + jsdom for renderer tests
apps/desktop/tests/renderer/**       component and hook tests (new)
apps/desktop/tests/setup/renderer.ts jsdom setup and typed fake of window.shopos
docs/contributing/ci.md              how CI works, required checks, branch protection, how to run locally
```

**Structure Decision**: Everything CI-specific lives in `.github/`, `scripts/ci/` and `config/`; test configuration stays in each package. No new package.

## Milestones

Today is 2026-11-14. Dates are estimates for one builder working alongside feature work; renderer coverage (M3) is the big unknown and is re-estimated after M2.

| # | Dates | Milestone | Exit criteria |
|---|---|---|---|
| M0 | 14 Nov (done) | **Spike and baseline** | Packages installed; coverage proven inside Electron's Node; baseline recorded in `research.md` |
| M1 | 15 to 22 Nov | **Report-only pipeline** | Repo on GitHub (owner action); `ci.yml` runs quick checks, tests with coverage, build and e2e on a PR and reports coverage per package; nothing blocks; e2e passes on Linux under a virtual display |
| M2 | 23 Nov to 6 Dec | **Core and main process to 90%** | `packages/core` at 90% on all four metrics; main process (db, repositories, services, ipc, entry, preload) at 90%; each in PRs of 400 lines or fewer |
| M3 | 7 Dec to about 16 Jan 2027 | **Renderer to 90%** | Large screens split per the React skill; hooks, components, screens and state tested; desktop total at 90%; **estimate to be revised after the first renderer PRs** |
| M4 | the day M3 closes | **Gate ON** | `COVERAGE_ENFORCE=true`; branch protection on `main` with the required checks, squash only, no force push, admins included, zero required reviews; deliberate failing PRs prove each check blocks (SC-001, SC-002) |
| M5 | 1 week after M4 | **Cross-platform smoke and hardening** | `smoke.yml` runs on macOS and Windows after merge and nightly; vulnerability and secret scanning running; flake report in the run summary; `docs/contributing/ci.md` written |

```
 M0 ✔ ─► M1 report-only ─► M2 core + main to 90% ─► M3 renderer to 90% ─► M4 GATE ON ─► M5 smoke + hardening
                                                    (revise estimate here)
```

**Interaction with feature work**: the 001 MVP milestones (build starts 7 Dec) overlap M3. New 001 code is written with its tests (so it does not widen the gap); the renderer split and its tests happen as the screens are touched. If M3 threatens the MVP date, the options are: move the gate-ON date later (it is a separate PR), or exclude nothing and add time; the spec forbids lowering the 90% target silently.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Renderer to 90% takes longer than planned | High | Medium | Split screens first; test hooks (cheap) before screens; re-estimate after the first 3 PRs; gate-ON date can move |
| Branch coverage 90% unreachable on some UI code | Medium | Medium | Measure first; raise as a finding with data; never lower silently |
| Linux Electron e2e flaky or needs sandbox flags | Medium | Medium | One retry with trace; flake report; fix root causes |
| macOS and Windows minutes cost more | Medium | Low | Run only after merge and nightly; confirm allowance (O3) |
| Gate blocks an urgent fix | Low | Medium | Fix forward with a small PR; no bypass is configured, by design |

## Complexity Tracking

No constitution violations. The only addition beyond the plan's tooling is one shared `config/coverage.ts` module, justified by the requirement that the threshold and exclusions live in one reviewed place (FR-011, FR-012).
