# Shop OS

Billing, stock, credit and control for Indian hardware shops. Built solo, first for the owner's own shop. Current feature: `specs/001-shop-os-mvp` (desktop app: inventory entry and a basic no-tax bill). Everything else in the PRD is a later feature.

## Read first

- Rules that override everything: `.specify/memory/constitution.md`
- Requirements: `docs/reference/PRD.md` (long-term), `specs/<feature>/spec.md` (current)
- Design: `specs/<feature>/plan.md`, `research.md`, `data-model.md`, `contracts/`
- Work list: `specs/<feature>/tasks.md`; run scenarios in `specs/<feature>/quickstart.md`
- Architecture (long-term design, layers, patterns): `docs/reference/architecture.md`
- Design guidelines (light and dark): `docs/design/design-guidelines.md`

## Skills: load the matching one before you work

Project skills in `.claude/skills/` hold the coding standards. Use them.

| Working on | Skill |
|---|---|
| Any code (size, naming, control flow, purity) | `shopos-engineering-standards` |
| React screens, components, hooks | `shopos-react-components` |
| Radix UI, theme, light and dark, messages | `shopos-radix-design-system` |
| Business rules in `packages/core` | `shopos-core-domain` |
| Schema, migrations, queries, backups | `shopos-database-drizzle` |
| Main process, preload, IPC commands, printing | `shopos-electron-ipc` |
| Electron security and performance hardening (fuses, permissions, navigation, packaging) | `shopos-electron-hardening` |
| Services, repositories, layering | `shopos-service-layer` |
| Tests | `shopos-testing` |
| Starting or finishing a feature or task | `shopos-feature-workflow` |
| Reviewing a change | `shopos-code-review` |

Pull requests: one concern each, titled `type(scope): summary`, described with `.github/pull_request_template.md`, within 200 (small) / 400 (target) / 800 (hard) changed lines; measure with `pnpm pr:size`. Details: `docs/contributing/pull-requests.md`.

Limits (lint warnings): file 200 lines (tests 300), function 40, component 120, complexity 10, parameters 4, nesting 2. Control flow: ternary and `&&`, never `continue`, no nested ternaries (lint errors). Layering is lint-enforced: core imports nothing outer; the renderer never imports main-process, Node or database code.

## Non-negotiable rules (full text in the constitution)

- Never change or delete a saved bill version, bill line, stock movement or ledger entry. Fix with cancel, an opposite entry, or (same day, permitted role, from feature 005) a new logged bill version that keeps the number. Constitution v2.0.0.
- Save bill + lines + stock movements in ONE transaction. Print and share only after the commit.
- Money is integer paise; quantity is integer thousandths. No floats. Rounding lives in `packages/core/src/money.ts`.
- Stock is the sum of movements. Never write item stock without a movement.
- Business rules go in `packages/core` (no Electron, DB or UI imports). The UI never touches the database; it calls IPC commands from `specs/<feature>/contracts/ipc-commands.md`.
- Tests first for `packages/core` and anything that writes bills, stock or ledger.
- Every table has UUID `id`, `business_id`, `shop_id`.
- Back up only with SQLite's online backup API, never by copying the live file.

## Stack

TypeScript (strict), pnpm workspace, Electron + React 18 + Radix UI (`@radix-ui/themes`, `radix-ui`), Vite, SQLite via better-sqlite3 + Drizzle, Zod for validation, Vitest (unit, integration), Playwright for Electron (end to end).

## Layout

```
packages/core/            pure TS rules (money, quantity, billing, stock, numbering)
apps/desktop/src/main/    Electron main: db/, repositories/, services/, ipc/
apps/desktop/src/preload/ typed bridge
apps/desktop/src/renderer/ React screens and components
apps/desktop/drizzle/     generated migrations
docs/reference/           PRD and architecture reference
specs/                    one folder per feature
```

## Commands

- `pnpm install`: install (needs network; the Electron binary is downloaded here)
- `pnpm test`: Vitest for `packages/core` and `apps/desktop` (unit and integration, in-memory SQLite)
- `pnpm typecheck`, `pnpm lint`, `pnpm format`
- `pnpm dev`: run the desktop app against a throwaway dev database
- `pnpm build`: production bundle; `pnpm --filter @shopos/desktop package`: installer
- `pnpm test:e2e`: Playwright for Electron (run `pnpm build` first)
- After changing `apps/desktop/src/main/db/schema.ts`: `pnpm --filter @shopos/desktop db:generate`

Notes: the installed drizzle-orm is 0.45 (drizzle-kit 0.31), so table extras use the array form `(tableColumns) => [index(...), check(...)]`. better-sqlite3 has ONE native binary per install, and it must be the ELECTRON build (ABI 148 for Electron 43; see `specs/017-ci-github-workflow/research.md`). The app, the Vitest integration tests and the Playwright specs all use it: `pnpm test` in `apps/desktop` runs Vitest inside Electron's Node (`ELECTRON_RUN_AS_NODE=1`, see `apps/desktop/scripts/vitest-electron.mjs`). `apps/desktop/scripts/ensure-electron-sqlite.mjs` runs on `postinstall` and before `dev`, `test` and `test:e2e`, and downloads the matching prebuilt binary if the file is the wrong build. Do NOT run `pnpm rebuild better-sqlite3` (it builds for plain Node and breaks the app). Running `npx vitest` directly uses plain Node and fails with `NODE_MODULE_VERSION`; use `pnpm test` or `pnpm test:watch`. `packages/core` has no native code and still runs in plain Node. Playwright specs read the database with the `sqlite3` CLI. electron-builder rebuilds the module when packaging.

## Explaining (chat replies, docs, skills)

Every explanation uses a **concrete example** and, where there is structure or flow, an **ASCII diagram**. Lead with the point in plain words, then the example (use the shop's own data: a bill, an item, ₹ amounts), then the diagram. Keep diagrams under about 70 characters wide so they render in a terminal. Tables for comparisons; diagrams for layers, data flow, state changes, before/after and file layout.

```
Screen --> typed API --> IPC handler --> Service --> Repository --> SQLite
                                           |
                                           +--> @shopos/core (pure rules)
Example: save bill C1/26-27/000123  (2 pcs x ₹120 = ₹240)
```

## Recommendations and verdicts

Every verdict, recommendation or suggestion (code, design, process, tooling, specs, reviews) gives four things:

1. **Why**: the reasoning, tied to this project (constitution, spec, the shop's data).
2. **Trade-off**: what it costs, and the alternatives considered and rejected (a table for comparisons).
3. **Industry practice**: what leading product companies do (for example Google, Meta, Uber, GitHub, Shopify). Say so when no reliable practice was found; do not invent one.
4. **References**: links to the sources. Mark vendor blogs and secondhand summaries as such, and prefer primary sources (official docs, papers, the company's own engineering writing).

Example: require CI checks before merging to `main`. Why: `main` becomes the counter's installer, and a mis-totalled bill must never ship (constitution VI). Trade-off: about 3 minutes per merge, against relying on memory. Practice: Google runs presubmit tests and reviews almost every change before commit. Reference: [Software Engineering at Google, ch. 9](https://abseil.io/resources/swe-book/html/ch09.html).

## Working with Spec Kit here

1. One feature per spec. Order: `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-analyze`, `/speckit-implement`.
2. Do not build anything that is not in the current feature's spec. V2, V3 and Later PRD items need their own spec.
3. Cite requirement IDs (FR-, NFR-, EC-, US-) in specs and tasks.
4. If a library behaviour, legal rule or hardware detail is unverified, record it as an open item in `research.md`. Do not state it as fact.
5. Tax and numbering rules are confirmed by the shop's CA. Bill numbers: consecutive, unique per financial year, at most 16 characters.
6. Ask before changing the stack, adding a package or service, or touching the constitution.

## Style

- Names must be readable and say what a value holds or what a function does. No single-letter names anywhere (not `e`, `i`, `r`, `m`, `x`, `S`), including loop counters, callbacks and tests. Write `event`, `itemIndex`, `response`, `matchingItem`, `calculateLineAmount`. Booleans read as questions (`isCancelled`). Put units in names (`...Paise`, `...Milli`). ESLint `id-length` enforces the single-letter rule; constitution principle VIII.
- Conventions: constants `UPPER_SNAKE_CASE` (`API_BASE_URL`); enums and their members `PascalCase` (`UserRole.Admin = "ADMIN"`); interfaces `I` prefix + PascalCase (`IUser`); types `PascalCase` without prefix (`UserStatus`); variables, parameters, functions and methods `camelCase`; classes and components `PascalCase`.
- Design: follow `docs/design/design-guidelines.md` (constitution X). Light and dark mode both supported and checked on every screen (System, Light, Dark). Radix tokens and component props only: no hex colours, no inline `style`. Status always has a word as well as a colour. Printed bills are always light. Use the shared message, status and format components.
- Small, single-responsibility components and functions. Components are pure (props and state in, markup out; no data fetching or business rules). Functions are pure where possible; side effects live at the edges.
- Placement: every component and every service has its own folder, holding its code, tests, styles (`.module.css`, `.module.scss` once the `sass` package is approved), `constants.ts` and `types.ts`; nothing of it lives in a separate tests or styles tree. A component's constants, types and interfaces live in that component's folder; anything shared across folders goes in a `shared` folder. Do not make a file shared for one user.
- Plain, small modules; prefer the libraries already chosen over wrappers.
- Use Radix components for dialogs, selects, tables, tabs and toasts.
- Keyboard-first counter screens; large tap targets; no information by colour alone.
- Keep screen text in one place so Hindi can be added later.
