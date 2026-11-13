# Shop OS

Billing, stock, credit and control for Indian hardware shops. Built solo, first for the owner's own shop. Current feature: `specs/001-shop-os-mvp` (desktop app: inventory entry and a basic no-tax bill). Everything else in the PRD is a later feature.

## Read first

- Rules that override everything: `.specify/memory/constitution.md`
- Requirements: `docs/reference/PRD.md` (long-term), `specs/<feature>/spec.md` (current)
- Design: `specs/<feature>/plan.md`, `research.md`, `data-model.md`, `contracts/`
- Work list: `specs/<feature>/tasks.md`; run scenarios in `specs/<feature>/quickstart.md`

## Non-negotiable rules (full text in the constitution)

- Never edit or delete a saved bill, bill line, stock movement or ledger entry. Fix with cancel or an opposite entry.
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

Notes: the installed drizzle-orm is 0.36, so table extras use the object form `(t) => ({ ... })`, not the array form. better-sqlite3 has ONE native binary per install, so Node (vitest) and Electron (e2e, dev) need different builds: for e2e run `npx prebuild-install -r electron -t 33.4.11` inside the better-sqlite3 folder, and run `pnpm rebuild better-sqlite3` to switch back before `pnpm test`. Playwright specs read the database with the `sqlite3` CLI for this reason. electron-builder rebuilds it when packaging.

## Working with Spec Kit here

1. One feature per spec. Order: `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-analyze`, `/speckit-implement`.
2. Do not build anything that is not in the current feature's spec. V2, V3 and Later PRD items need their own spec.
3. Cite requirement IDs (FR-, NFR-, EC-, US-) in specs and tasks.
4. If a library behaviour, legal rule or hardware detail is unverified, record it as an open item in `research.md`. Do not state it as fact.
5. Tax and numbering rules are confirmed by the shop's CA. Bill numbers: consecutive, unique per financial year, at most 16 characters.
6. Ask before changing the stack, adding a package or service, or touching the constitution.

## Style

- Names must be readable and say what a value holds or what a function does. No single-letter names anywhere (not `e`, `i`, `r`, `m`, `x`, `S`), including loop counters, callbacks and tests. Write `event`, `itemIndex`, `response`, `matchingItem`, `calculateLineAmount`. Booleans read as questions (`isCancelled`). Put units in names (`...Paise`, `...Milli`). ESLint `id-length` enforces the single-letter rule; constitution principle VIII.
- Plain, small modules; prefer the libraries already chosen over wrappers.
- Use Radix components for dialogs, selects, tables, tabs and toasts.
- Keyboard-first counter screens; large tap targets; no information by colour alone.
- Keep screen text in one place so Hindi can be added later.
