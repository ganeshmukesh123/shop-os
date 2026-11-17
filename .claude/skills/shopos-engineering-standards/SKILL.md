---
name: shopos-engineering-standards
description: "Use when writing, changing or refactoring ANY code in Shop OS (TypeScript, React or SQL). Sets the size limits, naming, control-flow style, purity and comment rules that every file must follow. Load it before writing code and before reviewing code."
---

# Shop OS engineering standards

Goal: code a stranger can read, change and extend without fear. Small, pure, well named, shallow. These rules apply to every file. Authority: constitution principles VIII, IX and VII.

## 1. Size limits

| Thing | Limit | Enforced by |
|---|---|---|
| File | 200 lines (tests 300) | ESLint `max-lines` (warning) |
| Function or method | 40 lines | ESLint `max-lines-per-function` (warning) |
| React component | 120 lines | Review |
| Cyclomatic complexity | 10 | ESLint `complexity` (warning) |
| Parameters | 4; more means one typed object `IFooOptions` | ESLint `max-params` (warning) |
| Nesting depth of if/else, loops, try | 2 | ESLint `max-depth` (warning) |

When a file nears its limit, split by responsibility (not by line count): one reason to change per file. A file that needs "and" to describe it is two files.

## 2. Naming

- No single-letter names: variables, parameters, functions, methods, classes, properties (ESLint `id-length` error).
- Names say what a value holds or what a function does: `billDiscountPaise`, `calculateLineAmount`, `findItemsByName`. No `data`, `info`, `temp`, `handle`, `doIt`, `util`.
- Booleans read as questions: `isCancelled`, `hasNegativeStock`, `canCancelBill`.
- Units in names when not obvious: `...Paise`, `...Milli`, `...Millis`.
- Constants `UPPER_SNAKE_CASE`; interfaces `I` + PascalCase (`IBill`); types PascalCase (`PaymentMode`); enums and members PascalCase; variables and functions camelCase; classes and components PascalCase.
- Callbacks get real names too: `(billLine) => ...`, `(changeEvent) => ...`.

## 3. Control flow

Prefer **expressions** to statements.

```ts
// Choose a value: one ternary
const statusLabel = isCancelled ? "Cancelled" : "Saved";

// Guarded output or a guarded value: && inside an expression, JSX or an arrow body
{hasError && <ErrorMessage text={errorText} />}
const onEscape = (keyboardEvent) => keyboardEvent.key === "Escape" && closeDialog();
// Not as a bare statement: `isOpen && closeDialog();` is rejected by ESLint no-unused-expressions.
// In statement position use an if or a guard clause, on its own lines (see "Conditions").

// Many cases: a lookup table, not an else-if chain
const LABEL_BY_PAYMENT_MODE: Record<PaymentMode, string> = { cash: "Cash", upi: "UPI", card: "Card", unpaid: "Unpaid" };
```

Rules:
- **Never `continue`.** Filter first (`items.filter(isActive)`) or call a small function. (ESLint `no-continue` error.)
- **No nested ternaries.** One ternary reads well; two do not. Use a lookup table or a small function. (ESLint `no-nested-ternary` error.)
- **At most 2 levels of nesting.** Flatten with a guard clause (early return for the failure case), a helper function, or a lookup table.
- **Guard clauses are fine** for failure exits at the top of a function; they are how depth stays low.
- No `else` after a `return` (ESLint `no-else-return`); no `if` as the only statement inside an `else` (`no-lonely-if`).
- Prefer `map`, `filter`, `find`, `reduce` over index loops when the intent is clearer. Use a loop when it is clearer.
- No `switch` on strings that grows; use a lookup table or the strategy pattern.

```ts
// Bad: depth 3, continue, else after return
for (const entry of entries) {
  if (entry.nameMatch) {
    if (isRecent(entry)) { keep.add(entry.fileName); } else { continue; }
  }
}

// Good: filter, then act
entries.filter(hasNameMatch).filter(isRecent).forEach((entry) => keep.add(entry.fileName));
```

### Conditions

- **Compute, then test the name.** Put the condition in a named boolean (`isXxx`, `hasXxx`, `canXxx`) on the line above. The `if` holds only that name: no operators, no `!`.
- **No negation, no double negation.** Name what is true (`isLoaded`), never `!isLoaded` or `!isNotLoaded`. If the failing case is the one you act on, name it directly (`isStockShort`, `isOverCreditLimit`).
- **No single-line `if`.** Always braces, body on its own lines.

```ts
// Bad
if (bill.lines.length > 0 && bill.status === BillStatus.Draft) saveBill(bill);
if (!isNotLoaded) { showItems(items); }

// Good: ₹240 bill against a ₹100 credit limit
const isOverCreditLimit = billTotalPaise > creditLimitPaise;
if (isOverCreditLimit) {
    showCreditError();
}
```

## 4. Functions and purity

- One job per function. Pure by default: same input, same output, no hidden reads (clock, random, database, files, `window`).
- Side effects live at the edges (repositories, IPC handlers, screens' event handlers) and enter pure code as arguments (`now: Date`, `idGenerator`).
- No boolean flag parameters (`save(item, true)`); use two functions or an options object.
- Return values, do not mutate arguments. Prefer `readonly` for inputs.
- Do not return `null` for "failed"; throw a typed `CoreError` with a code, or return a typed result.

## 5. Types and constants

- No `any`. `unknown` plus narrowing at boundaries; Zod validates data from outside (IPC, files).
- Magic numbers and strings become named constants in the component folder (`constants.ts`) or `shared/constants`.
- A type used in one component lives in its folder (`types.ts`); used in two folders, it moves to `shared/`.
- **One folder per component and per service.** Its code, tests, styles, constants and types all live in that folder (see `shopos-react-components` section 1 and `shopos-service-layer` section 2a). Never put a component's test in a far-away `tests/` tree or its styles in a global file.

## 6. Comments and dead code

- Comments explain **why**, not what. If a comment explains what, rename or split instead.
- Public functions in `@shopos/core` get a one-line doc comment with units and rounding.
- No commented-out code, no TODO without an issue or task id, no unused exports (delete them; git has history).

## 6b. Explaining and documenting

Docs, comments on non-obvious design, PR descriptions and review findings explain with a **concrete example** and, where there is flow or structure, an **ASCII diagram** (under about 70 characters wide). Use the shop's own data.

```
Cancel bill C1/26-27/000123 (₹240.00)

  bill      saved  ------------------>  cancelled   (reason required)
  movement  -2 pcs (sale)  then  +2 pcs (sale_cancel)   (never edited)
  stock     10 -> 8        then   8 -> 10
```

## 7. Imports and structure

- Dependencies point one way (see `shopos-service-layer`). `@shopos/core` imports nothing from Electron, the database or React.
- No deep relative imports like `../../../x`; import from the package or the folder's `index.ts`.
- One export per file for components; barrels (`index.ts`) only at package or folder roots.

## 8. Before you finish

- [ ] `pnpm lint` shows no new warnings; `pnpm typecheck` clean; `pnpm test` passes
- [ ] No file, function or component over the limits; no single-letter names
- [ ] Control flow follows section 3; nesting at most 2
- [ ] New constants and types are in the right folder
- [ ] Nothing in the change is dead or speculative (constitution VII)
