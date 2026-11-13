<!--
Sync Impact Report
Version change: 1.0.0 -> 1.1.0 (added principle VIII, Readable Names; MINOR)
Modified principles: none
Added sections: Core Principles VIII
Earlier (1.0.0, template -> initial ratification): Core Principles I-VII, Technical and Compliance Constraints, Development Workflow and Quality Gates, Governance
Removed sections: none
Templates reviewed: .specify/templates/plan-template.md (Constitution Check section reads this file), spec-template.md, tasks-template.md (no change needed)
Follow-up: none
-->
# Shop OS Constitution

Shop OS is a billing, stock, credit and control system for Indian hardware shops, built by one person, first for the owner's own shop. These principles protect the shop's money and data. They override convenience.

## Core Principles

### I. Never Lose or Alter a Bill (NON-NEGOTIABLE)
A bill, once saved, is never edited or deleted. Mistakes are fixed by cancelling with a recorded reason (or, later, by a return or credit note); a cancelled bill keeps its number and that number is never reused. A bill, its lines and its stock movements are saved in one database transaction, and the bill is committed before any printing or sharing starts, so a printer or network failure can never lose a sale.

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

## Technical and Compliance Constraints

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
- **Gates**: the plan's Constitution Check must pass before research and again after design; `/speckit-analyze` must show no unresolved conflict with this constitution before implementation starts.
- **Definition of done** for a task: code and tests merged, lint and type checks clean, relevant quickstart scenario passes, checklist box ticked in `tasks.md`.
- **Release**: a new version reaches the shop every 2 weeks only after offline testing passes; the previous version stays installable for rollback; new features switch on after a short staff walkthrough.
- **Milestones and trial**: each feature plan carries dated milestones with exit criteria. A feature is not complete until used at the counter alongside the old method and its success criteria are measured.
- **Unconfirmed facts**: any library behaviour, legal rule or hardware behaviour that is not yet verified is recorded as an open item in the feature's `research.md`, with the milestone that will resolve it, and is never written as settled fact.

## Governance

This constitution supersedes other practices and conversation habits. Every plan, analysis and review checks compliance with it. A violation must be removed or justified in the plan's Complexity Tracking table; an unjustified violation blocks the work.

**Amendments**: state the reason, change the text, bump the version, update the Sync Impact Report at the top, and check the plan, spec and tasks templates and the active feature's documents for needed changes. Versioning: MAJOR for removing or redefining a principle; MINOR for adding a principle or section; PATCH for wording fixes. The owner approves amendments.

**Runtime guidance** for day-to-day work lives in `CLAUDE.md`.

**Version**: 1.1.0 | **Ratified**: 2026-11-13 | **Last Amended**: 2026-11-13
