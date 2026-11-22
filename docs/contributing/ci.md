# Continuous integration

**Applies to**: every pull request and every push to `main`. **Spec**: `specs/017-ci-github-workflow`. **Workflow file**: `.github/workflows/ci.yml`.

CI runs the same commands you run on your machine, on a clean Linux runner. It exists so that a mis-totalled bill or a broken installer never reaches `main` (constitution VI).

## 1. The pipeline

```
Pull request or push to main
        |
        v
  Quick checks ------------+
        |                  |
        v                  v
  Tests and coverage      Build
        |                  |
        +--------+---------+
                 v
            End-to-end

  Alongside, never waited on:  PR size, Dependency audit, Secret scan
```

Example: you open a PR titled `feat(core): round bill total`. Quick checks runs first (about 45 s). Tests and coverage and Build start together when it passes. End-to-end starts when both are done. A new push to the same PR cancels the older run.

## 2. Each check, and how to fix it

| Check (name on GitHub) | What it runs | Fix it locally |
|---|---|---|
| **Quick checks** | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:scripts`, `pnpm check:migrations`, and on a PR `node scripts/ci/check-pr-title.mjs` | `pnpm format` for formatting; read the lint or type error; for migrations run `pnpm --filter @shopos/desktop db:generate` and commit the result; rename the PR to `type(scope): summary`, 72 characters or fewer |
| **Tests and coverage** | `pnpm test:coverage` (Vitest for `packages/core` and `apps/desktop`), then a coverage table in the run summary | `pnpm test`; open `apps/desktop/coverage/index.html` for the uncovered lines |
| **Build** | `pnpm build`, then uploads `apps/desktop/out` for the next job | `pnpm build` |
| **End-to-end** | Playwright for Electron under a virtual display (`xvfb-run`), one retry | `pnpm build && pnpm test:e2e`; download the `playwright-report` artifact for the trace and screenshot |
| PR size (informational) | `scripts/pr-size.sh`, red over 800 changed lines unless the PR has the `mechanical` label | `pnpm pr:size`; split the PR |
| Dependency audit | `pnpm audit --prod` and `pnpm audit`, high severity and above | Upgrade the package. A new advisory can turn this red with no code change; never silence the job |
| Secret scan (informational) | TruffleHog over the commit range | Remove the secret and rotate it; the history still has it |

## 3. Run everything locally

```
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:scripts \
  && pnpm check:migrations && pnpm test:coverage && pnpm build && pnpm test:e2e
```

`pnpm test:e2e` needs `pnpm build` first. Run `pnpm test` (not `npx vitest`) because the tests run inside Electron's Node; see CLAUDE.md for the better-sqlite3 note. CI installs with `pnpm install --frozen-lockfile`: if you changed a dependency, commit `pnpm-lock.yaml`.

## 4. Which checks block a merge

The ruleset "main protection" on `main` (read on 2026-11-22) requires four status checks: **Quick checks**, **Tests and coverage**, **Build**, **End-to-end**. It also blocks deleting `main` and force pushes. PR size, Dependency audit and Secret scan are shown but not required.

Not set today, though spec 017 asks for them (task T037): requiring the branch to be up to date before merging, allowing squash merge only, and requiring a pull request. Until those are set, a stacked PR can merge without re-running on the new base, so use "Update branch" after the PR below it merges.

## 5. The 90% coverage gate

Coverage is measured on every run and shown in the run summary. The 90% threshold (lines, statements, functions, branches) is written in `config/coverage.ts` but **not enforced**: `COVERAGE_ENFORCE` is `false` until task T036 switches it on, in its own PR, after `main` measures 90% on every metric. Do not describe the gate as active before then.

## 6. Reading a run

Open the run on GitHub, then **Summary**. It lists:

- the coverage table per package (from `scripts/ci/coverage-summary.mjs`);
- **End-to-end flakes**: tests that failed once and passed on the retry (`scripts/ci/flaky-summary.mjs`). A green run can still list flakes. A test that flakes twice in a week needs an issue; see the weekly report if it is set up (task T041);
- the PR size table (pull requests only).

Artifacts on the run: `coverage-reports` and `playwright-report` (14 days), `app-build` (7 days).

## 7. Safety rules for the workflow files

- Third-party actions are pinned to a full commit SHA, with the release named in a comment.
- Workflows have read-only `contents` permission and use no secrets; `pull_request_target` is never used.
- Add an exception or exclusion only with a written reason in the PR.
