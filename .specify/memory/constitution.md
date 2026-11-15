<!--
Sync Impact Report
Version change: 2.0.0 -> 2.0.1 (Technical Constraints "Code layout": plain `constants.ts` and `types.ts` in each folder, and the folder rule now covers main-process services as well as components; PATCH, owner decision 2026-11-15, task T093).
Earlier version change: 1.4.0 -> 2.0.0 (Principle I redefined: a same-day edit by a permitted role creates a new version; MAJOR). Owner decision 2026-11-15, audit finding C1, PRD FR-BIL-017.
Modified principles: I. Never Lose or Alter a Bill -> I. Never Lose or Alter a Saved Bill Version
Added sections: none
Templates reviewed: no change needed. Follow-up: spec 003 FR-014 builds the edit; spec 001 stays cancel-and-rebill (no roles or audit log yet).
Earlier (1.4.0: Development Workflow adds change size and PR rules. 1.3.0: new X Design Consistency. 1.2.0: VIII expanded with naming conventions, new IX Small Pure Code. 1.1.0: added VIII Readable Names. 1.0.0, template -> initial ratification): Core Principles I-VII, Technical and Compliance Constraints, Development Workflow and Quality Gates, Governance
Removed sections: none
Templates reviewed: .specify/templates/plan-template.md (Constitution Check section reads this file), spec-template.md, tasks-template.md (no change needed)
Follow-up: none
-->
# Shop OS Constitution

Shop OS is a billing, stock, credit and control system for Indian hardware shops, built by one person, first for the owner's own shop. These principles protect the shop's money and data. They override convenience.

## Core Principles

### I. Never Lose or Alter a Saved Bill Version (NON-NEGOTIABLE)
A saved bill version is never changed or deleted. Mistakes are fixed by cancelling with a recorded reason, by a return or credit note, or, on the same business day only and only by a role with permission, by an edit that saves a **new version** of the bill: the bill keeps its number, the previous version stays stored and readable, and the edit is written to the audit log with user, time and reason. No version is ever overwritten. A cancelled bill keeps its number and that number is never reused. Until roles and the audit log exist (feature 005), bills can only be cancelled and re-billed. A bill, its lines and its stock movements are saved in one database transaction, and the bill is committed before any printing or sharing starts, so a printer or network failure can never lose a sale.

### II. Stock and Balances Come From Immutable Records
Stock quantity is derived from append-only stock movements, and party balances from ledger entries. Movements and ledger entries are inserted, never updated or deleted; corrections are new, opposite entries. Any cached total (for example stock on an item) must equal the sum of its records and must be verifiable by a test. Every number on a screen or report must trace back to source documents.

### III. Money and Quantity Are Integers
Money is stored and calculated as integer paise. Quantity is stored as integer thousandths of the item's unit. Floating point is never used for either. Rounding is one written, tested rule in the shared core, never done in a screen. Display uses Indian grouping (1,00,000).

### IV. Offline-First
Every counter function works with no internet. The device owns a complete local database. Network services (sync, push, cloud backup) are optional layers added later and must never be required to bill. Records use UUID ids and carry business and shop ids from day one so sync and multi-shop can be added without migrating data.

### V. Business Rules Live in a UI-Free Core
Pricing, discounts, quantity rules, stock folding, numbering and validation live in the shared `@shopos/core` package, which imports no Electron, database or UI code. The desktop app, and later the server and phone apps, call the same functions, so offline and online can never disagree.

### VI. Test-First for Money, Billing and Stock (NON-NEGOTIABLE)
For anything in `@shopos/core` and for any code that writes bills, stock movements or ledger entries: write the tests first, see them fail, then implement. Other code needs tests before a task is marked done. Each user story has an end-to-end scenario in the feature's `quickstart.md` that must pass before its milestone closes. No known defect that can lose, duplicate or mis-total a bill may be open at release.

### VII. Simplicity and Scope Discipline
Build only what the current feature spec asks for. PRD items tagged V2, V3 or Later stay out until their own spec starts. Prefer the platform and the chosen libraries (Electron, React, Radix UI, SQLite, Drizzle) over wrappers and extra layers. Adding a package, service or abstraction beyond the plan needs a written reason in the plan's Complexity Tracking table. Buy, don't build: WhatsApp links, UPI QR from the bank, file-based imports.

### VIII. Readable Names
Every variable, parameter, function, method, class, type, file and database column has a name that says what it holds or does. No single-letter names anywhere, including loop counters, callback parameters and test code. No unexplained abbreviations. Functions are named for what they do (`calculateLineAmount`, not `calc` or `doIt`); values are named for what they hold (`billDiscountPaise`, not `d` or `x`); booleans read as questions (`isCancelled`, `hasNegativeStock`). Units go in the name when not obvious (`...Paise`, `...Milli`). Linting enforces the single-letter rule; review enforces the rest.

Naming conventions (examples):

```ts
const API_BASE_URL = "https://api.example.com"; // constants: UPPER_SNAKE_CASE

enum UserRole { // enums: PascalCase name and members
  Admin = "ADMIN",
  User = "USER",
  Guest = "GUEST",
}

interface IUser { // interfaces: "I" prefix, then PascalCase
  id: number;
  name: string;
  role: UserRole;
}

type UserStatus = "ACTIVE" | "INACTIVE"; // types: PascalCase, no prefix
```

Variables, parameters, functions and methods are camelCase; classes and React components are PascalCase.

### IX. Small, Pure Code, Kept Where It Belongs
Keep components and functions small and single-purpose (single responsibility); if one needs "and" to describe it, split it. Components are pure: they render from props and state and do not fetch data, touch the database or hold business rules. Functions are pure wherever possible: same input gives the same output, with side effects (database, files, printing, clock, randomness) pushed to the edges and passed in. Constants, types, interfaces and enums that belong to one component live in that component's own folder; anything used by more than one folder lives in a `shared` folder. Do not create a shared file for something only one component uses.

### X. Design Consistency, Light and Dark
Every screen follows `docs/design/design-guidelines.md`. Both light and dark mode are supported on every screen and checked before a screen is done; the user can choose System, Light or Dark. Colours and sizes come from theme tokens and component props, never hard-coded values; status is never shown by colour alone; the same job uses the same component, wording and place everywhere. Printed and PDF bills are always light. A screen is not done until it passes the guideline's new-screen checklist.

## Technical and Compliance Constraints

- **Code layout**: each React component and each main-process service has its own folder holding its code, its styles, its constants (`constants.ts`), its types and interfaces (`types.ts`) and its tests; cross-folder code lives in `shared/` (renderer: `apps/desktop/src/renderer/shared/`; rules: `packages/core`).
- **Stack**: TypeScript (strict) throughout; Electron + React + Radix UI for the desktop app; SQLite with Drizzle for local data. A later server uses Node.js and PostgreSQL as set out in the architecture reference. Changing the stack requires an amendment.
- **Electron security**: renderer runs with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; a narrow typed preload bridge; a restrictive Content-Security-Policy; the database is never touched from the renderer. Keep Electron updated.
- **Database**: WAL mode, foreign keys on, schema changes only through generated migrations, backups only through SQLite's online backup API (never by copying the live file), and every backup is proven by a real restore.
- **Compliance is data, confirmed by a professional**: tax, numbering and legal wording are configurable and confirmed with the shop's CA before go-live. Defaults recorded in the PRD: bill numbers are consecutive, unique per financial year and at most 16 characters (letters, digits, hyphen, slash); a composition Bill of Supply carries the header "composition taxable person, not eligible to collect tax on supplies" and shows no tax; customer consent follows the DPDP requirements before 13 May 2027.
- **Privacy and records**: customer data is limited to what the shop needs, with consent recorded; bills and ledgers are kept at least 72 months; audit records are append-only.
- **Performance targets**: item search about 0.2 s at 50,000 items; bill save and print about 1 s, offline included (PRD NFR-001, NFR-002).
- **Accessibility**: large tap targets, readable contrast, no information by colour alone; Radix components are used for dialogs, menus and focus handling.

## Development Workflow and Quality Gates

- **Spec-driven order**: constitution, then per feature `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-analyze`, `/speckit-implement`. One feature per spec. No code before its spec, plan and tasks exist.
- **Reference documents**: `docs/reference/PRD.md` and the architecture reference are the long-term source of requirements and design; feature specs cite their requirement IDs (FR-, NFR-, EC-, US-). If a spec conflicts with the PRD, resolve it in writing before building.
- **Change size and pull requests**: every change goes through a pull request described with `.github/pull_request_template.md`, titled `type(scope): summary`, one concern each (never a refactor mixed with a behaviour change). Size limits in changed lines excluding generated files: 200 small, 400 target ceiling, 800 hard ceiling (above 400 needs a written reason; above 800 is split unless purely mechanical). Measured with `pnpm pr:size`. Details: `docs/contributing/pull-requests.md`.
- **Gates**: the plan's Constitution Check must pass before research and again after design; `/speckit-analyze` must show no unresolved conflict with this constitution before implementation starts.
- **Definition of done** for a task: code and tests merged, lint and type checks clean, relevant quickstart scenario passes, checklist box ticked in `tasks.md`.
- **Release**: a new version reaches the shop every 2 weeks only after offline testing passes; the previous version stays installable for rollback; new features switch on after a short staff walkthrough.
- **Milestones and trial**: each feature plan carries dated milestones with exit criteria. A feature is not complete until used at the counter alongside the old method and its success criteria are measured.
- **Unconfirmed facts**: any library behaviour, legal rule or hardware behaviour that is not yet verified is recorded as an open item in the feature's `research.md`, with the milestone that will resolve it, and is never written as settled fact.

## Governance

This constitution supersedes other practices and conversation habits. Every plan, analysis and review checks compliance with it. A violation must be removed or justified in the plan's Complexity Tracking table; an unjustified violation blocks the work.

**Amendments**: state the reason, change the text, bump the version, update the Sync Impact Report at the top, and check the plan, spec and tasks templates and the active feature's documents for needed changes. Versioning: MAJOR for removing or redefining a principle; MINOR for adding a principle or section; PATCH for wording fixes. The owner approves amendments.

**Runtime guidance** for day-to-day work lives in `CLAUDE.md`.

**Version**: 2.0.1 | **Ratified**: 2026-11-13 | **Last Amended**: 2026-11-15
