# Pull requests and commits

**Applies to**: every change to Shop OS, including work by one person. Use a branch and a pull request (PR) even when you review it yourself: the PR is where size, description and checks are held to the standard.
**Authority**: constitution, Development Workflow. Skills: `shopos-feature-workflow` and `shopos-code-review`.

## 1. Size

Small PRs are reviewed properly, merged safely and reverted cleanly. Measure with `pnpm pr:size` (counts changed lines, excluding generated files).

| Size (changed lines) | Verdict | What to do |
|---|---|---|
| Up to 200 | Small | Ideal |
| 201 to 400 | Normal | Target ceiling |
| 401 to 800 | Large | Needs a one-line reason in the description, and a split plan if it can be split |
| Over 800 | Too large | Split it. Only mechanical changes (a rename tool run, a formatter) may exceed this, and must say so |

Rules:
- **Excluded from the count**: lock files (`pnpm-lock.yaml`), generated migration snapshots (`apps/desktop/drizzle/meta/**`), and generated code. Everything else counts, tests included. If tests are more than half the change, say so.
- **About 10 files or fewer** is typical. More is a signal to check the scope.
- **One concern per PR.** A bug fix, a behaviour change, a refactor and a rename are separate PRs. Never mix a refactor with a behaviour change: reviewers cannot tell what changed.
- **Mechanical changes alone**: renames, formatting and file moves are their own PR, with no logic change, so the diff can be skimmed.
- **Each PR leaves the app working**: lint, typecheck and tests pass, and the app starts. No PR relies on "the next one fixes it".
- **A schema change** carries its migration, the data-model doc and the tests that prove it, in one PR.

## 2. How to split a large change

Build bottom-up, one layer per PR, each independently valuable and tested (the vertical-slice order in `shopos-feature-workflow`):

1. Core rule and its tests (`@shopos/core`)
2. Schema, migration and repository
3. Service (use case) and integration tests
4. IPC command and contract
5. Hook and components, then the screen
6. End-to-end scenario and docs

For splitting a large screen (for example `NewBillScreen`): one extracted part per PR, tests green before and after.

## 3. Title

Format: `type(scope): summary` in the imperative, 72 characters or fewer, no full stop.

| Type | Use for |
|---|---|
| `feat` | New behaviour |
| `fix` | Bug fix |
| `refactor` | Restructure with no behaviour change |
| `perf` | Faster, same behaviour |
| `test` | Tests only |
| `docs` | Documents, specs, skills |
| `build` / `chore` | Tooling, dependencies, config |
| `style` | Formatting or renames only |

Scope is the feature number or area: `001`, `core`, `db`, `ipc`, `renderer`, `design`, `specs`.

Examples: `feat(001): cancel a bill with a reason and restore stock` · `fix(db): recreate bill triggers after table rebuild` · `refactor(renderer): extract BillSearchBox from NewBillScreen`.

## 4. Description

Every PR uses `.github/pull_request_template.md`. Required sections:

1. **Summary**: what changed and why, in two or three sentences. Why before what.
2. **Links**: spec folder, task IDs (`T068`), PRD requirement IDs (`FR-BIL-018`), review finding if any.
3. **Changes**: bullets grouped by layer (core, database, service, IPC, UI, docs).
4. **Not in this PR**: what was deliberately left out, so nobody asks.
5. **How it was tested**: the exact commands run and their results; for UI, screenshots or a short recording in **light and dark**.
6. **Risk and rollback**: data or migration impact, what could go wrong, how to undo it (and whether a backup is needed first).
7. **Size**: output of `pnpm pr:size`, and the reason if over 400.
8. **Checklist**: limits, lint, typecheck, tests, docs, themes, constitution.

## 5. Commits

- One logical step per commit; the message says **why**.
- Same format as the title for the first line: `type(scope): summary`. Body (optional) explains the reason and any trade-off. Reference task IDs.
- No "wip", "fix stuff" or "updates". No commented-out code or debugging leftovers.
- Add the co-author trailer configured for the project when an AI assistant contributed.
- Do not rewrite shared history. Squash on merge so the main branch has one commit per PR with the PR title.

## 6. Before opening a PR

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass (quote the results)
- [ ] `pnpm pr:size` is within the limits above
- [ ] You reviewed your own diff with `shopos-code-review`
- [ ] Docs, contract, data model and `tasks.md` are updated in the same PR
- [ ] Nothing unrelated is in the diff

## 7. Reviewing

- Review the description first: does it match the diff and the spec?
- Use the severity levels in `shopos-code-review` (Blocker, Major, Minor, Nit). Blockers and Majors must be fixed before merge; Minors may be tracked.
- Approve only after running the checks, not on faith.
