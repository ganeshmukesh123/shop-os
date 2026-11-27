<!--
Title format: type(scope): summary   (imperative, 72 characters or fewer)
Types: feat, fix, refactor, perf, test, docs, build, chore, style.   Scope: feature number or area (001, core, db, ipc, renderer, design, specs).
Guideline: docs/contributing/pull-requests.md
-->

## Summary
<!-- What changed and why, in two or three sentences. Why before what. -->

## Links
- Spec: `specs/NNN-name`
- Tasks: T000
- Requirements: FR-XXX-000
- Review finding / issue (if any):

## Changes
<!-- Group by layer. Delete layers that do not apply. -->
- **Core**:
- **Database / migration**:
- **Service / repository**:
- **IPC / contract**:
- **UI**:
- **Docs / tasks**:

## Not in this PR
<!-- What was left out on purpose. -->
-

## How it was tested
<!-- Exact commands and results. For UI: screenshots or a short recording in light AND dark. -->
- [ ] `pnpm lint` and `pnpm format:check`: 
- [ ] `pnpm typecheck`: 
- [ ] `pnpm test:coverage` (or `pnpm test`): 
- [ ] `pnpm build && pnpm test:e2e` (if UI or flow changed): 
- [ ] CI checks green: Quick checks, Tests and coverage, Build, End-to-end (guide: `docs/contributing/ci.md`). The 90% coverage gate is off until T036 (`COVERAGE_ENFORCE` in `config/coverage.ts`), so a green Tests and coverage does not yet mean 90%: read the coverage table in the run summary
- [ ] Manual check: 

| Light | Dark |
|---|---|
|  |  |

## Risk and rollback
<!-- Data or migration impact, what could go wrong, how to undo it, whether a backup is needed first. -->
- Migration: none / yes (number, what it does)
- Rollback:

## Size
<!-- Output of `pnpm pr:size`. Over 400 changed lines needs a reason; over 800 must be split. -->
- Changed lines (excluding generated files):
- Files:
- Reason if over 400:

## Checklist
- [ ] One concern per PR; no refactor mixed with a behaviour change
- [ ] Within size limits; app works and all checks pass
- [ ] File, function and component limits met; no single-letter names; control-flow rules followed
- [ ] Layering respected (core pure; no SQL outside repositories; renderer uses only the typed API)
- [ ] Saved bills, lines and movements still immutable; money is integer paise; repeatable writes idempotent
- [ ] Looks right in light and dark; every status has a word; keyboard works
- [ ] Spec, contract, data model, quickstart and `tasks.md` updated
- [ ] Unverified facts recorded as open items, not stated as fact
