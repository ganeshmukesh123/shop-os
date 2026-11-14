---
name: shopos-core-domain
description: "Use when writing or changing business rules in packages/core (@shopos/core): money, quantity, pricing, discounts, billing totals, stock folding, bill numbering, validation, state machines, errors. Keeps the domain pure, integer-based, test-first and independent of Electron, database and UI."
---

# The domain core (`@shopos/core`)

Authority: constitution I, II, III, V, VI. Architecture: `docs/reference/architecture.md` sections 10.1 to 10.8 and 11. Every rule that decides money, stock or validity is written once, here, and reused by the desktop app now and the server and phone apps later.

## 1. Purity rules

- **No imports** from Electron, React, Radix, Drizzle, better-sqlite3, Node built-ins (`fs`, `path`, `node:*`) or anything that does I/O. Only the language and Zod. (ESLint `no-restricted-imports` blocks this in `packages/core`.)
- **No hidden inputs.** No `new Date()`, `Math.random()`, `crypto` or environment reads inside a rule. Time and ids come in as arguments (`now: Date`).
- **No mutation** of arguments; return new values.
- **Deterministic**: the same input always gives the same output, on every device.

## 2. Money and quantity

- Money is integer **paise**; quantity is integer **thousandths** of the unit. No floats, ever. Name them with units: `ratePaise`, `quantityMilli`.
- Rounding is one written rule in `money.ts`: half up, once per line (`mulQtyRate`), percent as basis points (`percentOfPaise`). Never round in a screen or a repository.
- Guard the edges: reject non-integers, negatives where not allowed, and amounts above the safe-integer limit with a `CoreError`.
- Display formatting (Indian grouping) lives here too (`formatRupees`), so every screen and print shows the same thing.

## 3. Structure

| File | Responsibility |
|---|---|
| `money.ts`, `quantity.ts` | Value arithmetic, rounding, formatting, parsing |
| `billing.ts`, `draftBill.ts` | Line and bill totals; evaluating a draft from user text |
| `stock.ts` | Folding movements into stock; invariants |
| `numbering.ts` | Financial year, bill number template |
| `types.ts`, `commands.ts` | Domain types and the command contract (Zod schemas) |
| `errors.ts` | `CoreError` with a stable `code` |

Add a new rule as a **new small file** with one responsibility, not a bigger old file. Export from `index.ts` only what other packages need.

## 4. Patterns (use these, and only these)

| Pattern | When | Example |
|---|---|---|
| Value object | Units and rounding must not be mixed up | `Paise`, quantity in milli |
| Strategy | A rule varies by shop setting | Landed-cost allocation by value or quantity; later: composition vs regular tax |
| State machine | Documents with a lifecycle | Bill: `saved` to `cancelled` only, once |
| Specification | Owner-configurable policies | Discount limits, approval rules, as small combinable predicates |
| Domain events | Aggregates report what happened | Returned with the result; storing them is the data layer's job |

Not used, on purpose: plugin frameworks, DI containers, event buses, abstract factories (architecture 10.7). Vary behaviour with data and small functions.

## 5. Errors

Throw `CoreError(code, message)` with a stable, documented `code` (`EMPTY_BILL`, `INVALID_DISCOUNT`, `INVALID_QUANTITY`). Messages are for people; codes are for code. Never return `null` to mean "invalid". Never swallow an error.

## 6. Tests first (NON-NEGOTIABLE for this package)

1. Write the failing test; see it fail for the right reason.
2. Implement the smallest change; see it pass.
3. Add a **golden** case (hand-checked totals) for any new money path.
4. Add edge cases: zero, one paisa, rounding half, maximum, negative, decimal on a whole-number unit.
5. Property-style checks (parts add up, stock equals the sum of movements) where cheap. A property-test library is not installed; ask before adding one.

## 7. Checklist

- [ ] No forbidden import; no clock, random or I/O inside the rule
- [ ] Paise and milli only; rounding in one place
- [ ] New rule in its own small file, with a `CoreError` code for each failure
- [ ] Failing test written first; golden and edge cases present
- [ ] File 200 lines or less; function 40 or less; names readable
