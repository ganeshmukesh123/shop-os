---
description: "Task list for the GitHub workflow (CI and merge protection)"
---

# Tasks: GitHub Workflow (CI and merge protection)

**Input**: `specs/017-ci-github-workflow/` (spec, plan, research)

**Prerequisites**: spec decisions Q1 to Q3 (done), packages approved and installed (done), repository on GitHub (owner action, T006).

**Tests**: Included. Scripts have tests; the workflow is verified by deliberately failing PRs (T015, T038).

**Rules for every task**: one PR of 400 changed lines or fewer (`pnpm pr:size`), titled `type(scope): summary`, using the PR template. Follow the `shopos-*` skills (names, size limits, control flow). Open items O1 to O6 are in `research.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency)
- **[Story]**: US1 broken code cannot merge · US2 same tests for every change · US3 coverage at 90% · US4 fast readable feedback · US5 other platforms · US6 other merge rules

---

## Phase 1: Setup (M0 done, M1 starts)

- [X] T001 Install `@vitest/coverage-v8@2.1.9` in `packages/core` and `apps/desktop`, and `@testing-library/react`, `@testing-library/user-event`, `jsdom` in `apps/desktop` (approved 2026-11-14)
- [X] T002 Spike: coverage runs inside Electron's Node via `node apps/desktop/scripts/vitest-electron.mjs run --coverage` (result: works; recorded in `research.md` S1)
- [X] T003 Measure the baseline for core and desktop and record it in `specs/017-ci-github-workflow/research.md` S2 (vitest 2: core 67.2%, desktop 38.2% lines; renderer 0%). Re-measured under vitest 4 (the numbers are not comparable): core 77.4% lines / 85.2% branches, desktop 39.8% / 30.4%, main-process slice 74.2% / 64.5% (research F9)
- [X] T004 Create `config/coverage.ts` exporting `COVERAGE_THRESHOLD_PERCENT = 90`, `COVERAGE_EXCLUDED_PATHS` (generated files, `*.d.ts`, test folders only) and `COVERAGE_ENFORCE = false`
- [X] T005 Use `config/coverage.ts` in `packages/core/vitest.config.ts` and `apps/desktop/vitest.config.ts`: provider `v8`, reporters `text`, `lcov`, `json-summary`, `html`, include `src/**`, thresholds (lines, statements, functions, branches) applied only when `COVERAGE_ENFORCE` is true; add `test:coverage` scripts in root, core and desktop `package.json` _(verified: `pnpm test:coverage` runs core in Node and desktop through Electron's Node; report-only exits 0; with `COVERAGE_ENFORCE=true` both packages fail naming the 90% threshold. Root script uses `--no-bail --no-sort` because desktop depends on core and pnpm otherwise skips it when core fails.)_
- [ ] T006 Owner action: push the repository to GitHub, confirm the default branch is `main`, and note whether the repository is private (affects runner minutes) (resolves O5) _(2026-11-15: pushed; `origin` is on GitHub and `origin/HEAD` points to `main`. Still to note: private or public.)_

**Checkpoint**: `pnpm test:coverage` prints per-package coverage locally and fails nothing yet.

---

## Phase 2: The pipeline in report-only mode (M1) - US2, US4, US6

**Goal**: every PR runs all steps and reports; nothing blocks yet.

- [X] T007 [P] [US2] Add `scripts/ci/check-migrations.sh`: run the migration generator and fail if it changes any file (schema changed without a generated migration), with a clear message _(verified: passes on the real tree; fails with exit 1 when the generator adds a file, using the `MIGRATION_GENERATE_COMMAND` test hook)_
- [X] T008 [US2] Create `.github/workflows/ci.yml` with the quick-checks job: checkout, set up pnpm (version from `package.json`) and Node (from `.nvmrc`), cache the package store, `pnpm install --frozen-lockfile`, `prettier --check`, `pnpm lint`, `pnpm typecheck`, `scripts/ci/check-migrations.sh`; triggers `pull_request` to `main`, `push` to `main`, `workflow_dispatch`; `permissions: contents: read`; concurrency group cancelling older runs; job timeouts. Look up and pin the current versions of every third-party action (resolves O2) _(written and statically validated: YAML parsed, every action pinned to a verified full SHA, timeouts, least privilege. Not yet run on GitHub: that is T015.)_
- [X] T009 [P] [US6] Add `scripts/ci/check-pr-title.mjs` (allowed types: feat, fix, refactor, perf, test, docs, build, chore, style; `type(scope): summary`, 72 characters or fewer) with its tests in `scripts/ci/check-pr-title.test.mjs`; call it from the quick-checks job on pull requests _(9 tests; also wired into the workflow; `pnpm test:scripts` runs all script tests)_
- [ ] T010 [US2] _(job written in `ci.yml` and statically validated; the virtual display, the Electron libraries and the sandbox flag can only be proven by a run on GitHub, so this box stays open and O1 stays unverified)_ Add the end-to-end job to `ci.yml`: needs the build job, downloads the Electron binary from cache, runs `pnpm test:e2e` under a virtual display on Linux, uploads the Playwright report, traces and screenshots on failure. Verify the app launches under the virtual display and note any Chromium sandbox flag required (resolves O1)
- [X] T011 [P] [US4] Add `scripts/ci/coverage-summary.mjs`: read each package's `coverage-summary.json` and write a markdown table (per package and combined, four metrics, files under 90%) to `$GITHUB_STEP_SUMMARY`; include the `pnpm pr:size` line and time per step; tests for the table builder _(tests included; run against the real coverage output)_
- [X] T012 [US2] Add the tests-with-coverage job (needs quick checks) running `pnpm test:coverage` for all packages, uploading the HTML and `lcov` reports as artifacts and calling `coverage-summary.mjs`; add the build job (`pnpm build`, needs quick checks); order the jobs so slow steps run only after quick checks pass; report-only (no threshold failure) _(written and statically validated, job order checked; not yet run on GitHub: T015. Report-only: the threshold is not enforced.)_
- [X] T013 [P] [US2] Set Playwright to `retries: process.env.CI ? 1 : 0`, `trace: "on-first-retry"` in `apps/desktop/playwright.config.ts`, and make the summary list any test that passed only on retry as a flake _(config verified to load; flaky report `scripts/ci/flaky-summary.mjs` built and tested against a real Playwright JSON report; `retries: 1` only on CI)_
- [X] T014 [P] [US6] Add non-required jobs: dependency vulnerability scan (high severity and above) and secret scanning; record whether the audit is stable enough to become required (resolves O4) _(jobs written; O4 answered in research.md: `pnpm audit` currently reports 81 findings, so it stays non-required)_
- [ ] T015 [US2] Verify M1: open a PR and confirm all jobs run in order; then, on a scratch branch, break each step on purpose (format, lint, type, migration, PR title, test, build, e2e) and confirm each is caught; record results in `research.md`

**Checkpoint (M1 exit)**: a PR shows quick checks, tests with coverage, build and e2e, plus a readable summary; nothing blocks; e2e passes on Linux.

---

## Phase 3: Core and main process to 90% (M2) - US3

**Goal**: `packages/core` and the main process at 90% on lines, statements, functions and branches, each on its own.

### Core (`packages/core`)

- [X] T016 [P] [US3] Write `packages/core/tests/types.test.ts` covering every Zod schema in `types.ts` with valid inputs, each invalid field, and boundary values (name length, UUID `clientBillId`, discount, quantity) (done: `packages/core/tests/types.test.ts`, 32 tests, zod 4 behaviour pinned)
- [X] T017 [P] [US3] Write `packages/core/tests/commands.test.ts` covering the command map in `commands.ts` and the exports in `index.ts` (every command has an input schema and a result type) (done: `packages/core/tests/commands.test.ts`, contract list and package exports)
- [X] T018 [P] [US3] Close the remaining gaps with tests: `money.ts` (parse and format edge cases), `quantity.ts` (unit and decimal rules), `draftBill.ts` (percent and error paths), `numbering.ts` (financial year boundary), `stock.ts` (done: edge cases in the money, quantity, numbering, stock and draftBill tests; the work found and fixed a real defect: `evaluateDraft` threw on a huge amount, commit 919beed)
- [X] T019 [US3] Confirm `packages/core` is at 90% on all four metrics; record it in `research.md` (done 2026-11-14: core 100% lines/statements/functions, 99.21% branches; `COVERAGE_ENFORCE=true` run exits 0. One branch left: the defensive non-CoreError path in `draftBill.ts` line 98, unreachable without mocking)

### Main process (`apps/desktop/src/main`, `preload`)

- [X] T020 [P] [US3] Tests for `main/db/seed.ts` (first-run creates one business, one shop, a default profile; second run changes nothing) and the `connection.ts` branch (done: `database.test.ts` covers seed, connection and the schema contract; `repositories.test.ts` the repository gaps)
- [X] T021 [P] [US3] Tests for `main/ipc/index.ts` and the uncovered paths of `main/ipc/handlers.ts` (every command registered; unexpected error mapped to a safe result) (done: `handlers.commands.test.ts` and `ipcRegistration.test.ts`; every command and the unknown-command guard)
- [X] T022 [P] [US3] Tests for the uncovered paths in `BillRepository.ts`, `StockRepository.ts` and `ItemRepository.ts` (done: repository gaps, partly in `repositories.test.ts` and `database.test.ts`)
- [X] T023 [P] [US3] Refactor `main/services/electronRenderer.ts` to take the Electron window API as an argument, and test it with a fake window (print, PDF, failure, cancel) (done: `electronRenderer.ts` now builds from a window factory, `electronRenderer.test.ts`)
- [X] T024 [US3] Refactor `main/index.ts` (174 lines) into small functions that take the Electron API as an argument (create window, register dialogs, register handlers, start backups, quit hook) and test each with fakes; keep any untestable line to a minimum and justify it in a comment (done: `main/index.ts` split into `main/app/*` modules taking the Electron objects as arguments; tests in `appConfig`, `mainWindow`, `securityHeaders`, `backupLifecycle`, `shell`, `startApp` and `mainEntry`; no line excluded)
- [X] T025 [P] [US3] Refactor `preload/index.ts` so the bridge is built by a function from the command list, and test that it exposes exactly the contract commands and nothing else (done: `preload/bridge.ts` builds the api from the command list; `preload.test.ts` proves it exposes exactly the contract commands)
- [X] T026 [US3] Confirm the main process is at 90% on all four metrics; re-measure the whole baseline (Step 2 of the sequence) and record it in `research.md` (done 2026-11-15: main process + preload 100% lines, statements and functions, 98.0% branches; enforced run on that slice exits 0; whole baseline re-measured in research F10; whole desktop package is still 56% because the renderer is untouched)

**Checkpoint (M2 exit)**: core and main process at 90% on every metric.

---

## Phase 4: Renderer to 90% (M3) - US3

**Goal**: the React renderer at 90%, with the desktop total at 90%. Estimate to be revised after T029 (see plan).

- [X] T027 [US3] Renderer test setup: `apps/desktop/tests/setup/renderer.ts` (jsdom, Testing Library cleanup), a typed fake of `window.shopos`, a `renderWithTheme` helper wrapping Radix `Theme`; configure Vitest so `tests/renderer/**` runs under jsdom _(done 2026-11-15, built with spec 001 T085: `vitest.config.ts` now has two projects, `main` and `renderer` (jsdom); `helpers/fakeShopos.ts` builds the fake through the real preload bridge so it uses the same command list; `helpers/fakeMatchMedia.ts` fakes the operating-system theme; `renderWithTheme.tsx`; `tests/renderer/rendererSetup.test.tsx`, 4 tests; the 221 existing tests still pass)_
- [X] T028 [P] [US3] Tests for `renderer/shared/api/api.ts`, `features/billing/billForm`, `features/billing/hooks/useDraftAutosave`, `features/inventory/hooks/useItems` and `shared/text/strings.ts` (command client success and failure, draft autosave and recovery, items list reload) _(done 2026-11-22: `api.test.ts`, `billForm.test.ts`, `useDraftAutosave.test.ts`, `useItems.test.ts`; `strings.ts` holds only text and is exercised, and shown at 100%, by every screen test, so it has no test of its own)_
- [X] T029 [P] [US3] Tests for `renderer/components`: `Toast`, `AdjustStockDialog`, `BillLineRow` (render, keyboard, validation messages); then re-estimate M3 from the effort and coverage gained _(done 2026-11-22: `AdjustStockDialog.test.tsx` and `Toast.test.tsx` existed; added keyboard dismissal to Toast and the amount, typing, Enter, discount-type and Remove cases to `BillLineRow.test.tsx`. Re-estimate: the desktop total is already above 90% on all four metrics, so M3 needs no further test work, see T035)_
- [X] T030 [US3] Split `NewBillScreen.tsx` (472 lines) following `shopos-react-components`: one extraction per PR (`useBillForm`, `useBillSave`, `BillSearchBox`, `BillLinesTable`, `BillSummaryPanel`, `RecoverDraftDialog`), tests green before and after each _(done 2026-11-21: same work as 001 T089, see there)_
- [X] T031 [US3] Tests for the extracted `NewBillScreen` hooks and components (search and add by keyboard, totals, save with a `clientBillId`, double-save, error toast, draft recovery) _(done 2026-11-21: behaviour tests for the whole screen (search and add by keyboard, totals, save once with a clientBillId, no double save, error toast, draft recovery and discard) plus tests for each extracted hook and component)_
- [X] T032 [P] [US3] Tests for `ItemsScreen` and `ItemForm` (search, add, duplicate warning, decimal rules, deactivate) _(2026-11-21: the ItemForm half is done: 12 behaviour tests, a validator test, hook tests and component tests; the ItemsScreen half (search, add, deactivate) is still open)_ _(2026-11-22: the ItemsScreen half was done by `ItemsScreen.test.tsx` (list, search, filters, deactivate, add form, edit, adjust stock; PR #107))_
- [X] T033 [P] [US3] Tests for `BillView` and `SettingsScreen` (print and PDF success and failure, backup section, number template warning) _(2026-11-21: the BillView half is done in BillView.test.tsx (print and PDF success and failure); the Settings half is still open)_ _(2026-11-21: the Settings half is done too: SettingsScreen.profile.test.tsx and SettingsScreen.backup.test.tsx, 20 cases)_
- [X] T034 [US3] Tests for `App.tsx` and `main.tsx` (navigation, shortcuts, negative-stock badge); re-measure; if branch coverage of 90% is out of reach for some UI code, write the evidence in `research.md` and raise it with the owner (resolves O6); never lower the threshold silently _(done 2026-11-22: `App.test.tsx` (PR #107) covers navigation, shortcuts and the badge; `main.test.tsx` mounts the entry. Re-measured: branches 96.92% desktop total, so no evidence file or owner decision is needed)_
- [X] T035 [US3] Confirm the desktop total and `main` are at 90% on lines, statements, functions and branches; record it in `research.md` _(done 2026-11-22: desktop total 99.17 / 98.83 / 97.77 / 96.92 (lines / statements / functions / branches), `src/main` 99.64 / 99.22 / 99.30 / 96.03, core 99.68 / 99.42 / 100 / 96.91; recorded in research F11, O6 answered. Measured on the branch with the T028 to T034 tests; the desktop total at `7b48cf8`, before those tests, was already above 90% on all four metrics (98.75 / 98.38 / 96.47 / 96.02); per-area figures were not measured there)_

**Checkpoint (M3 exit)**: every package at 90% on every metric.

---

## Phase 5: Switch the gate on (M4) - US1, US3

**Goal**: broken code cannot merge.

- [X] T036 [US3] Set `COVERAGE_ENFORCE = true` in `config/coverage.ts` (its own PR); confirm a deliberate coverage drop fails the run and names the files _(done 2026-11-22: with the flag on, `pnpm test:coverage` exits 0 (core 99.68 / 99.42 / 100 / 96.91, desktop 99.17 / 98.83 / 97.77 / 96.92). Deliberate drop: a throwaway `packages/core/src/deliberateDrop.ts` with 150 untested functions took core to 51.29 lines / 43.28 statements / 29.24 functions / 41.74 branches; the run printed `ERROR: Coverage for lines (51.29%) does not meet global threshold (90%)` (and the same for functions, statements, branches), exited 1, and the report table listed `deliberateDrop.ts` at 0% with its uncovered lines. The probe file was removed and is not in the PR. A smaller drop of one 9-line file stayed above 90% and did not fail, as expected: the threshold is on the package total. Whether CI's required check blocks a merge is T037 and T038)_
- [ ] T037 [US1] Configure branch protection on `main`: require the named checks (quick checks, tests and coverage, build, end-to-end), require the branch to be up to date, squash merge only, no force push or deletion, include administrators, **zero required reviews** (decision Q3); write the exact settings and check names in `docs/contributing/ci.md`
- [ ] T038 [US1] Prove blocking with deliberate failing PRs for lint, types, a unit test, a coverage drop, the build and an e2e scenario, plus a direct push to `main`; record each result (success criteria SC-001, SC-002, SC-005)

**Checkpoint (M4 exit)**: nothing merges unless every required check is green.

---

## Phase 6: Other platforms and hardening (M5) - US5, US4

- [ ] T039 [P] [US4] Write `docs/contributing/ci.md`: the pipeline diagram, each check and how to fix a failure, how to run everything locally (`pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build && pnpm test:e2e`), required checks and branch rules, how to read the run summary
- [ ] T040 [US5] Add `.github/workflows/smoke.yml`: build and start the packaged app on macOS and Windows after merge to `main` and nightly, run the core scenario (add item, save bill); first confirm the runner-minutes allowance and cost (resolves O3)
- [ ] T041 [P] [US4] Add a weekly flake report (tests that passed only on retry) to the run summary or a scheduled job; a test that flakes twice in a week gets an issue
- [ ] T042 [P] [US6] Add `.github/dependabot.yml` for weekly dependency updates (optional)
- [ ] T043 [P] [US4] Update `CLAUDE.md`, the PR template and the `shopos-testing` and `shopos-feature-workflow` skills with the real check names, the 90% gate and the local commands
- [ ] T044 [US4] Measure the run time against the 10-minute target (SC-003), tune caches and job parallelism, and record the result

**Checkpoint (M5 exit)**: smoke runs on macOS and Windows; documentation complete; run time within target.

---

## Dependencies and order

```
 T001-T003 done
     |
 T004 -> T005 -> T006 (owner) ---------------------+
                     |                              |
 T007, T009, T011, T013, T014 (parallel)            |
     \                |                             |
      T008 -> T012 -> T010 -> T015  (M1 exit)  <----+
                                  |
      T016-T018 [P] -> T019   (core)       T020-T025 [P] -> T026 (main)
                                  \________________/
                                          |
              T027 -> T028, T029 -> T030 -> T031 -> T032, T033 -> T034 -> T035 (M3 exit)
                                                                         |
                                              T036 -> T037 -> T038 (gate ON, M4)
                                                                         |
                                                  T039-T044 (M5)
```

- T036 must not start until T035 confirms 90% on `main`.
- T030 (splitting `NewBillScreen`) is several PRs; each keeps tests green.
- T030 and T031 were done ahead of T028 and T029, as spec 001 T089 (behaviour tests first, then one extraction per PR). The diagram's order was for re-estimating M3 coverage, not a build dependency; T028 and T029 stay open and still feed that estimate.
- Feature work on spec 001 continues in parallel and writes its own tests so the gap does not grow.

## Implementation strategy

1. **M1 first**: get a report-only pipeline running quickly; it shows the real numbers on every PR.
2. **Climb in small PRs**: core, then main process, then renderer; each PR adds tests, none changes behaviour without a test.
3. **Then switch the gate on** with T036 to T038 and prove it blocks.
4. Do not weaken the 90% target or add exclusions to reach it; evidence and an owner decision are required.

## Format validation

Every task starts with `- [ ]` or `- [X]`, has a sequential ID (T001 to T044), carries a story label only in story phases, and names exact files or settings. Each task is sized for one PR of 400 changed lines or fewer.
