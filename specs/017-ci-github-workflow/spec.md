# Feature Specification: GitHub Workflow (Continuous Integration and Merge Protection)

**Feature Branch**: `017-ci-github-workflow` (directory name only until the repository is on GitHub)

**Created**: 2026-11-14

**Status**: Draft (questions answered 2026-11-14; ready for `/speckit-plan`)

**Input**: User description: "Add a GitHub workflow that runs the tests, the end-to-end tests and coverage (above 90%), so that broken code is not merged."

**Source documents**: `.specify/memory/constitution.md` (VI test-first, development workflow, change size), `docs/contributing/pull-requests.md`, `.github/pull_request_template.md`, skills `shopos-testing` and `shopos-feature-workflow`, `specs/016-quality-nfr` (release checks).

**Depends on**: the project being hosted on GitHub (it has no remote today). Applies to every feature spec as the gate they all pass through.

## How it fits together

```
 developer branch
       |
       v
   open pull request  ------------------------------+
       |                                            |
       v                                            v
 +-------------------- GitHub Actions (on every PR and every push to main) -------+
 |                                                                                |
 |  1 quick checks     2 tests + coverage     3 build        4 end-to-end         |
 |  format, lint,      unit + integration,    app bundle     real Electron app,   |
 |  types, PR rules,   coverage >= 90%                       virtual display      |
 |  migrations in sync                                                            |
 |       |                    |                   |                 |             |
 +-------+--------------------+-------------------+-----------------+-------------+
         |                                                          |
         v                                                          v
   all required checks green?  ---- no ---->  merge button stays blocked
         |
        yes
         v
   squash-merge into main  --->  main stays releasable
```

Example: a PR changes how a bill discount rounds. If the golden test for a ₹850.00 bill now totals ₹849.99, step 2 fails, the PR shows a red check, and the merge button is disabled until the rule or the test is fixed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Broken code cannot reach main (Priority: P1)

Nobody, including the owner, can merge a change into `main` unless every required check passes. Direct pushes to `main` are blocked.

**Why this priority**: This is the whole point: money, stock and bills are protected only if a bad change is stopped before it ships.

**Independent Test**: Open a PR that breaks a test on purpose; confirm the merge is blocked. Fix it; confirm the merge is allowed. Try pushing directly to `main`; confirm it is refused.

**Acceptance Scenarios**:

1. **Given** a PR whose tests fail, **When** anyone tries to merge, **Then** the merge is blocked and the failing check is named.
2. **Given** all required checks pass, **When** the PR is squash-merged, **Then** `main` gets one commit with the PR title.
3. **Given** a direct push to `main`, **Then** it is rejected (rule applies to administrators too).
4. **Given** `main` moved after the PR's last run, **Then** the PR must be updated and re-checked before merging.

---

### User Story 2 - Every change is tested the same way (Priority: P1)

Each PR runs, in this order: formatting, lint, type check, unit and integration tests with coverage, build, and end-to-end tests of the real Electron app. A failure in any step is reported with the step, the test name and the output.

**Why this priority**: The constitution requires tests to pass before a task is done; this makes that automatic and identical for everyone.

**Independent Test**: Run the workflow on a clean branch; all steps run in order and pass. Break each step in turn (a lint error, a type error, a test, the build, an e2e scenario); each is caught by the right step.

**Acceptance Scenarios**:

1. **Given** a lint error or a single-letter name, **Then** step 1 fails.
2. **Given** a type error, **Then** step 1 fails.
3. **Given** a failing unit or integration test, **Then** step 2 fails and the test name is shown.
4. **Given** the app fails to build, **Then** step 3 fails.
5. **Given** a broken user flow (for example saving a bill), **Then** step 4 fails with a trace.
6. **Given** the schema was changed without a generated migration, **Then** step 1 fails ("migrations out of date").

---

### User Story 3 - Coverage stays above 90% (Priority: P1)

The test step measures coverage (lines, statements, functions, branches) and fails the build when it falls below the threshold. The threshold can only go up, never down. The report is attached to every run.

**Why this priority**: Without it, new code can slip in untested; money paths need tests. The owner chose 90% of everything, from day one, once the project has reached it.

**Independent Test**: Add a new function with no test; confirm coverage drops and the check fails with the file and lines named. Add the test; confirm it passes.

**Acceptance Scenarios**:

1. **Given** the gate is on and coverage is below 90%, **Then** step 2 fails and prints which files are under.
1a. **Given** the gate is not yet on (steps 1 to 4 of the sequence), **Then** the same run reports coverage but does not block.
2. **Given** coverage at or above the threshold, **Then** step 2 passes and the report is uploaded.
3. **Given** a PR that lowers the threshold or widens the exclusions, **Then** it needs an explicit written reason in the description and cannot be merged by itself without that review.
4. **Given** a PR that lowers coverage of changed files, **Then** the report shows which changed lines are uncovered.

---

### User Story 4 - Fast, readable feedback (Priority: P2)

Results arrive quickly and say what to fix. A run takes at most about 10 minutes. Failures show the reason, not just "failed". Reports (coverage, end-to-end traces and screenshots) are downloadable.

**Independent Test**: Time a clean run; confirm each failure type produces a readable message and an artifact.

**Acceptance Scenarios**:

1. **Given** a typical PR, **Then** all required checks finish in about 10 minutes or less (dependency caching on).
2. **Given** an e2e failure, **Then** the trace, screenshots and a short summary are attached.
3. **Given** a new push to the same PR, **Then** the older run is cancelled.
4. **Given** a run, **Then** the job summary shows test counts, coverage per package and the PR size.

---

### User Story 5 - Same checks on the platforms the shop uses (Priority: P2)

The required checks run on Linux. The packaged app is also smoke-tested on macOS and Windows (the owner's counter computer is a Mac first) on merges to `main` and nightly.

**Independent Test**: Trigger the nightly run; the app starts and completes the core scenario on macOS and Windows.

**Acceptance Scenarios**:

1. **Given** a merge to `main`, **Then** the macOS and Windows smoke run starts and reports its result.
2. **Given** a failure only on one platform, **Then** it is reported per platform and an issue or alert is raised.

---

### User Story 6 - Other merge rules (Priority: P3)

Beyond tests, the workflow enforces the PR rules already agreed: title format, size limit, no leaked secrets, no known-vulnerable dependencies.

**Independent Test**: Open PRs that break each rule; each is flagged.

**Acceptance Scenarios**:

1. **Given** a title not in `type(scope): summary` form, **Then** the title check fails.
2. **Given** a PR over 800 changed lines (excluding generated files) without the `mechanical` label, **Then** the informational size check shows red while tests, build and end-to-end still run; 401 to 800 requires a "reason" line in the description.
3. **Given** a committed secret or a dependency with a high-severity known vulnerability, **Then** the check fails.

---

### Edge Cases

- **Flaky end-to-end test**: at most one automatic retry, always recorded as a flake in the summary with the trace; a test that flakes twice in a week is fixed or quarantined with an issue, never silently ignored.
- **Native module mismatch**: tests, app and e2e must use the same Electron build of the SQLite binding (`ensure-electron-sqlite`); a mismatch fails fast with a clear message.
- **Runner has no display**: Linux e2e runs under a virtual display.
- **Fork or untrusted PR**: runs without secrets and with read-only permissions.
- **GitHub outage or slow runner**: checks can be re-run; merging is never forced around a missing check.
- **Documentation-only change**: still passes the quick checks; heavy steps may be skipped only by explicit path rules that cannot skip code, tests or config.
- **A new package or test folder**: not silently excluded from coverage; exclusions are listed in one reviewed file.
- **Dependency install fails (network)**: the run fails clearly; no stale cache is trusted without the lock file hash.

## Requirements *(mandatory)*

### Functional Requirements

**Triggers and protection**

- **FR-001**: The workflow MUST run on every pull request (including stacked PRs that target another PR's branch), on every push to `main`, and on manual request. The PR size is measured against the PR's own target branch (owner decision 2026-11-15).
- **FR-002**: `main` MUST be protected: direct pushes, force pushes and deletion refused; applies to administrators.
- **FR-003**: A PR MUST NOT be mergeable until every required check passes and the branch is up to date with `main`. No approving review is required (solo project); the checks are the protection and the self-review checklist in the PR template is still completed.
- **FR-004**: Merges MUST be squash merges so `main` has one commit per PR, titled with the PR title.

**Checks, in order**

- **FR-005**: Step 1 (quick checks) MUST run: formatting check, lint (zero errors; warnings reported), type check for all packages, migration-in-sync check (regenerating migrations produces no change), PR title format. PR size runs as its own informational job beside the pipeline: it shows red over 800 lines without the `mechanical` label, but no step waits on it and it is not a required check (owner decision 2026-11-15: a size warning must never skip the tests).
- **FR-006**: Step 2 MUST run all unit and integration tests with coverage, using the same test command developers use, and MUST fail on any failing test.
- **FR-007**: Step 3 MUST build the application bundle.
- **FR-008**: Step 4 MUST run the end-to-end tests against the built app under a virtual display and MUST fail on any failing scenario.
- **FR-009**: Steps MUST run in the order above; a failed earlier step MUST stop the slower later steps.

**Coverage**

- **FR-010**: Coverage MUST be measured for lines, statements, functions and branches, and MUST fail the run when any measured metric falls below the threshold. Threshold: **90% for every metric**, applied to `packages/core`, the main process and the renderer, each package on its own and the total. Branch coverage is included; if it proves unreachable for some UI code, that is raised as a finding with data, never lowered silently.
- **FR-010a**: The gate MUST be switched on only when `main` already measures at least 90% on every metric; before that the workflow runs in report-only mode (the sequence above).
- **FR-011**: The threshold MUST only ever increase; lowering it or adding exclusions MUST require a PR that states the reason.
- **FR-012**: Exclusions MUST be listed in one reviewed configuration file; nothing else may be excluded silently. The starting list is only generated files, type declarations and the test folders themselves. Bootstrap wiring (Electron entry file, preload) is **counted** unless the plan justifies excluding it in writing, since end-to-end runs do not contribute to coverage.
- **FR-013**: The coverage report (summary and detailed) MUST be uploaded on every run and summarised in the run page.

**Reporting and speed**

- **FR-014**: Each run MUST publish a summary: tests passed and failed, coverage per package, changed lines uncovered, PR size, and time per step.
- **FR-015**: Failed end-to-end runs MUST attach traces and screenshots.
- **FR-016**: Required checks SHOULD finish in about 10 minutes or less; dependency caching (package store, Electron download) MUST be used.
- **FR-017**: A newer push to the same PR MUST cancel the older run.

**Platforms and safety**

- **FR-018**: A post-merge and nightly job SHOULD smoke-test the packaged app on macOS and Windows.
- **FR-019**: The workflow MUST use least-privilege permissions, pinned versions of third-party actions, the Node version from `.nvmrc` and the package-manager version from `package.json`, and a frozen lock file (a changed lock file without a package change fails).
- **FR-020**: The workflow MUST NOT expose secrets to PRs from forks or use event types that run untrusted code with secrets.
- **FR-021**: Dependency vulnerability scan (high severity and above) and secret scanning SHOULD run on every PR.

**Flaky tests**

- **FR-022**: Automatic retries MUST NOT hide failures: unit and integration tests are never retried; end-to-end tests retry at most once and the retry is reported as a flake.

### Key Entities

- **Workflow**: The automated pipeline, its triggers and steps.
- **Required check**: A named result that must be green before merge (quick checks, tests and coverage, build, end-to-end, optional smoke runs).
- **Branch protection rule**: The repository setting that enforces the required checks.
- **Coverage threshold and baseline**: The minimum percentage, and the measured percentage it started from.
- **Coverage exclusions file**: The single reviewed list of files left out of measurement.
- **Run artifact**: Coverage report, e2e trace, screenshots, job summary.
- **Flake record**: A test that passed only on retry, with its trace.

## Decisions (owner, 2026-11-14)

| # | Question | Decision | What it means |
|---|---|---|---|
| Q1 | What does "above 90%" cover? | **Everything**: `packages/core`, the main process and the React renderer | The renderer needs component tests, so a component-test tool is required; nothing is counted out by default |
| Q2 | Day one or ratchet? | **Day one**: 90% is enforced from the first run the gate is switched on | The project must reach 90% **before** the gate is enabled, so the gate cannot be the first change (see the sequence below) |
| Q3 | Approvals? | **No required reviews**: this is a solo project; the checks are the protection | Branch protection requires the checks, not a reviewer; the self-review checklist in the PR template is still completed |

### What "day one" requires: the sequence

The gate must never be switched on while the project is below 90%, because that would block every merge, including the merges that raise coverage. So the work happens in this order:

```
 Step 1  put the repo on GitHub, add the workflow in REPORT-ONLY mode
            (measures coverage, runs everything, blocks nothing)
              |
 Step 2  measure the baseline  (today: never measured)
              |
 Step 3  raise coverage to 90% in small PRs
            (core -> main process -> renderer components and hooks)
              |           each PR is <= 400 lines, adds tests, no gate yet
              v
 Step 4  coverage >= 90% on main?  --- no --> keep adding tests
              |
             yes
              v
 Step 5  turn the gate ON: required checks + 90% threshold + branch protection
              |
 Step 6  from now on: any PR below 90% cannot merge
```

Example: if the baseline is 62% (core 88%, main process 74%, renderer 0%), Step 3 is roughly: tests for the main-process services and IPC, then hooks and components, until each package is at or above 90%. Only then does Step 5 happen.

### Dependencies this adds (each needs your approval before installing)

The constitution says to ask before adding a package. Proposed development dependencies, none installed yet:

| Purpose | Proposed package | Why |
|---|---|---|
| Coverage | `@vitest/coverage-v8` | Matches the test runner already in use |
| Render components in tests | `@testing-library/react`, `@testing-library/user-event` | Standard way to test components by what a user sees and does |
| Browser-like environment | `jsdom` | Required to render React in the test runner |

Whether coverage works while tests run inside Electron's Node (`ELECTRON_RUN_AS_NODE`) is unverified; it is the first spike in the plan.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: No change reaches `main` with a failing lint, type, unit, integration, build or end-to-end check, verified by a deliberate failing PR for each.
- **SC-002**: A deliberate coverage drop below the threshold fails the run and names the files, verified once before the gate is relied on.
- **SC-003**: Required checks finish in about 10 minutes or less for a typical PR on a warm cache.
- **SC-004**: Coverage is at least 90% on lines, statements, functions and branches for `packages/core`, the main process and the renderer, reached before the gate is switched on and never allowed to fall afterwards.
- **SC-005**: Zero merges to `main` bypass the checks (repository audit shows no direct pushes).
- **SC-006**: Flaky end-to-end tests: fewer than 2% of runs need a retry; any test that flakes twice in a week is fixed or quarantined with an issue.
- **SC-007**: A failed run tells the author what broke without opening the logs for most failures (job summary names the step and test).

## Assumptions

- The repository will be hosted on GitHub; it has a local git history only today, so pushing it to GitHub and enabling branch protection are part of delivering this feature.
- The default branch is `main`; PRs are squash-merged.
- Tests already run through `pnpm test` (Electron's Node, so tests, app and end-to-end share one SQLite binary) and end-to-end through `pnpm test:e2e` after `pnpm build`; the workflow reuses these commands instead of inventing new ones.
- No coverage tool is installed yet. A coverage provider and component-test tools must be added (new development dependencies, approved first, per the constitution; proposed list in the Decisions section), and whether coverage works when tests run inside Electron's Node is **unverified** and is the first planning spike.
- Reaching 90% on the renderer is substantial work (today the renderer has no unit tests), and branch coverage of 90% on UI code is the hardest target; the baseline measurement in Step 2 decides how large Step 3 is.
- Linux end-to-end under a virtual display is expected to work but is **unverified** for this app; the first run proves it.
- macOS and Windows smoke tests may cost more runner time than Linux; they run only after merge and nightly.
- Code signing and publishing releases are out of scope here (a later release workflow).
- The PR template and size rules in `docs/contributing/pull-requests.md` are the source of the title and size checks.
- Where another spec's wording conflicts, the constitution wins.
