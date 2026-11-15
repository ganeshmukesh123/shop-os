---
name: shopos-code-review
description: "Use when reviewing a Shop OS change, a pull request or your own finished work before calling it done. A severity-ranked checklist covering correctness, layering, size and naming limits, purity, security, data integrity, both themes, tests and docs."
---

# Code review checklist

Review as a staff engineer who must maintain this code for years. Report findings by severity, each with file and line, the problem, and the fix. Do not approve on faith: run `pnpm lint`, `pnpm typecheck` and `pnpm test` and quote the result.

## Severity

| Level | Meaning | Examples |
|---|---|---|
| Blocker | Loses or corrupts money, stock or a bill; breaks the constitution | A saved bill can be edited; stock written without a movement; non-idempotent save; floats for money |
| Major | Likely bug, security hole, or structure that will hurt soon | SQL in a service; renderer using Node; missing transaction; rule in a screen |
| Minor | Readability, small duplication, missing test for an edge | Long function; unclear name; missing empty state |
| Nit | Taste | Ordering of imports |

## 0. The pull request itself

- [ ] Size within limits (`pnpm pr:size`: 200 small, 400 target, 800 hard); over 400 has a stated reason
- [ ] One concern: no refactor, rename or formatting mixed with a behaviour change
- [ ] Title is `type(scope): summary`; description follows the template (Summary, Links, Changes, Not in this PR, How tested, Risk and rollback, Size, Checklist)
- [ ] Description matches the diff and the spec; test results are quoted, UI has light and dark screenshots
- [ ] Commits are logical steps with messages that say why

## 1. Correctness and data integrity (blockers first)

- [ ] Bill, lines, movements and counters change in **one** transaction; failure leaves nothing behind
- [ ] Saved bills, lines and movements are never updated or deleted; corrections are new rows
- [ ] Repeatable writes are idempotent (key plus unique index)
- [ ] Money is integer paise, quantity integer thousandths, no floats; rounding only in core
- [ ] Cached values equal the sum of their records (and a test proves it)
- [ ] A new column on `bill` is covered by the immutability trigger; a rebuilt table has its triggers back
- [ ] Time handling is explicit (UTC vs local business date); financial year logic only in core

## 2. Architecture and layering

- [ ] Dependencies point inward only; `@shopos/core` has no outer imports
- [ ] No SQL outside repositories; no business rules in screens, handlers or repositories
- [ ] Renderer uses only the typed API; no Node, Electron or database access
- [ ] New package, service or abstraction is justified in the plan (constitution VII); no speculative generality
- [ ] Ports exist only where a second implementation or fake exists

## 3. Security and privacy

- [ ] Electron defaults unchanged; every IPC input validated with Zod in main
- [ ] No customer data in logs or crash reports; no secrets in the repo
- [ ] No contact details stored without notice and consent (feature 008)

## 4. Size, naming and style (`shopos-engineering-standards`)

- [ ] File 200 lines or less (tests 300); function 40 or less; component 120 or less; complexity 10 or less; at most 4 parameters; nesting depth at most 2
- [ ] No single-letter names; names say what they hold or do; booleans read as questions; units in names
- [ ] Control flow: ternary for choosing a value, `&&` for guarded output, no `continue`, no nested ternary, guard clauses instead of deep else
- [ ] Conditions: computed into a named boolean first, `if` holds only that name; no `!`, no double negation (`!isNotX`); no single-line `if`
- [ ] Constants `UPPER_SNAKE_CASE`; interfaces `I...`; enums PascalCase
- [ ] Constants and types in the component folder or `shared/`; no dead or commented-out code

## 5. UI and design (`shopos-react-components`, `shopos-radix-design-system`)

- [ ] Pure, small components; logic in hooks; no data fetching in components
- [ ] Radix components and tokens; no hex colours; no inline `style`
- [ ] Looks right and passes contrast in **light and dark**; every status has a word
- [ ] Keyboard path works; focus visible; shared formatters used for money, quantity, dates
- [ ] Loading, empty, error and success states handled; text from `uiText`

## 6. Tests and docs

- [ ] Failing test written first for core, billing and stock; failure, atomicity and edge cases covered
- [ ] Tests deterministic and readable; no shared state
- [ ] Spec, contract, data-model, quickstart and `tasks.md` updated with the change
- [ ] Unverified claims recorded as open items, not stated as fact

## 7. How to report

```
Blocker  apps/desktop/src/main/services/BillingService.ts:84
  Saving prints inside the transaction; a printer failure would roll back a sale.
  Fix: commit first, then print; return PRINT_FAILED without touching the bill.
```

End with: what was checked, what commands were run and their results, what was **not** checked, and a clear verdict (approve, approve with minors, or changes required).
