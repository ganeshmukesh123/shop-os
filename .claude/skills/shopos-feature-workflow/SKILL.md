---
name: shopos-feature-workflow
description: "Use when starting, planning or finishing any Shop OS feature or task: the Spec Kit order, tracing PRD requirement IDs, adding a vertical slice from core to screen, the definition of done, and what to update in docs, tasks and the data model. Load before implementing from tasks.md."
---

# Feature workflow

Authority: constitution (Development Workflow and Quality Gates). Specs live in `specs/NNN-name/`; the index is `specs/README.md`. Reference docs: `docs/reference/PRD.md`, `docs/reference/architecture.md`, `docs/design/design-guidelines.md`.

## 1. Order of work

1. `/speckit-specify` (what and why, with PRD requirement IDs), `/speckit-clarify`, `/speckit-checklist`, `/speckit-plan` (how, with the architecture), `/speckit-tasks`, `/speckit-analyze`, then `/speckit-implement`. One feature per spec. No code before spec, plan and tasks exist. When code has run ahead of the documents, `/speckit-converge` appends the missing work to `tasks.md`.
2. Check the plan against the constitution (Constitution Check table) before and after design.
3. Work **one task at a time** from `tasks.md`, in dependency order. Tick the box only when the task's tests pass.
4. If the spec, plan or contract is wrong or missing something, **fix the document first** and say so; do not build around it.

## 2. A vertical slice, bottom up

For a user-visible behaviour, build in this order, each step tested before the next:

1. **Core rule** in `@shopos/core` (test-first; pure) and its `CoreError` codes.
2. **Schema and migration** (if data changes): `schema.ts`, `db:generate`, read the SQL, triggers, update `data-model.md`.
3. **Repository** method(s) with tests on the in-memory database.
4. **Service** method (one transaction; idempotent if repeatable) with integration tests.
5. **IPC command** in the five places (see the Electron skill) and the contract doc.
6. **Hook and components** (see the React and Radix skills): pure, small, both themes.
7. **End-to-end scenario** from `quickstart.md`.

Do not skip down the list: no screen before the rule and the service exist.

## 2b. Pull requests and commits

Follow `docs/contributing/pull-requests.md`. In short:

- **Size** (`pnpm pr:size`, changed lines excluding lock files and generated migration snapshots): 200 small, 400 target ceiling, 800 hard ceiling. Over 400 needs a one-line reason; over 800 is split unless purely mechanical.
- **One concern per PR.** Never mix a refactor, rename or format change with a behaviour change. One layer per PR when building a slice bottom-up.
- **Title**: `type(scope): summary` (feat, fix, refactor, perf, test, docs, build, chore, style), imperative, 72 characters or fewer.
- **Description**: use `.github/pull_request_template.md`: Summary (why first), Links (spec, task IDs, PRD IDs), Changes by layer, Not in this PR, How it was tested (commands and results, light and dark screenshots for UI), Risk and rollback, Size, Checklist.
- **Commits**: one logical step each, message says why, same `type(scope)` format, no "wip". Squash on merge.
- Each PR leaves the app working: lint, typecheck and tests pass. CI must be green on the four checks Quick checks, Tests and coverage, Build and End-to-end (`docs/contributing/ci.md`); the 90% coverage gate is reported now and enforced once spec 017 T036 is done.

## 3. Definition of done (a task)

- [ ] Tests written first for core, billing and stock paths; all tests pass
- [ ] PR within size limits (`pnpm pr:size`), one concern, described with the template
- [ ] `pnpm lint` has no new warnings; `pnpm typecheck` clean
- [ ] Size, naming and control-flow rules met (`shopos-engineering-standards`)
- [ ] Docs updated in the same change: spec/contract/data-model/quickstart as needed
- [ ] `tasks.md` box ticked, with any caveat written next to the task
- [ ] UI: light and dark checked, keyboard works, new-screen checklist done
- [ ] Anything unverified (library behaviour, legal rule, hardware) recorded as an open item in `research.md`, not stated as fact

## 4. Definition of done (a feature)

All tasks done; quickstart scenarios pass on the packaged app with networking off; success criteria measured; restore drill done; the owner has used it at the counter; `specs/README.md` status updated.

## 5. Working rules

- **Ask before**: changing the stack, adding a package or service, changing the constitution, deleting or rewriting applied migrations.
- **Small changes**: one concern per commit, message says why. Commit only when asked. Never rewrite history.
- **Traceability**: reference PRD IDs (FR-, NFR-, EC-, US-) in specs, tasks, and test names where useful.
- **Scope**: build only the current spec. V2, V3 and Later items need their own spec.
- **Reviews**: use `shopos-code-review` before calling work finished; findings with a severity, and fixes tracked.
- **Evidence over claims**: report what was run and what it printed, not what you expect.

## 6. Adding a feature spec (quick)

Copy the structure of `specs/001-shop-os-mvp`: spec (stories, requirements with PRD IDs, success criteria, assumptions), plan (context, constitution check, structure, milestones), research (decisions with alternatives; open items), data-model, contracts, quickstart, tasks. Number it next in sequence and add it to `specs/README.md`.
