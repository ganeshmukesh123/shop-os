# Implementation Plan: Items - Variants, Names and Paint Tinting

**Branch**: `002-items-variants-tinting` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-items-variants-tinting/spec.md`, PRD section 5, the architecture reference sections 6, 7.2 to 7.5, 8.4, 10.3 and 11.7, and feature 001's design (tables already in the architecture's shape, research D18).

## Summary

Turn the flat 001 item into a family with up to 4 variant axes, generated in one step. Add exact unit conversions, several search names per item with typo-tolerant ranked search, duplicate warnings, a logged merge that can be reversed for 30 days, paint and warranty fields, barcode labels, item import, and paint tinting: shades, formulas, colorants stocked in ml, a tinting charge, repeat shades and non-returnable tinted lines. Rules (signatures, combinations, conversions, ranking, duplicates, tint pricing and cost) are pure functions in `@shopos/core`; the main process adds tables and services; the renderer gets new screens built from Radix components. Saved bills, lines and movements stay immutable: merges and formula changes are pointers, new versions and new movements (research D6, D11).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS (unchanged)

**Primary Dependencies**: Unchanged from 001 (Electron ^43.8, React 18, Radix UI, drizzle-orm ^0.45, better-sqlite3 Electron build, Zod 4, Luxon). One possible addition needs owner approval: an XLSX parser (OD-2). Search and Code 128 are written in-house (research D4, D13).

**Storage**: The same local SQLite file; migrations `0013` onward add about 17 tables and new nullable columns (data-model.md). `stock_movement` and `bill_tender` are rebuilt once so their enums become lookup tables (research D17); after that, later features add movement types, tender modes and other enum values by INSERT, never by a rebuild.

**Testing**: Vitest (core rules test-first; services against in-memory SQLite inside Electron's Node), Playwright for Electron for the quickstart scenarios, a search benchmark with 50,000 generated variants.

**Target Platform**: macOS first; Windows and Linux from the same code.

**Project Type**: desktop-app (pnpm workspace: `packages/core`, `apps/desktop`).

**Performance Goals**: Search about 0.2 s at 50,000 variants (SC-002, NFR-001); family with 6 variants in under 2 minutes (SC-001); tinted bill in under 90 s (SC-003); 3,000-row import preview in under 30 s (SC-005); bill save still about 1 s with colorant movements (NFR-002).

**Constraints**: Offline; integer paise and thousandths (0.25 ml is 250 milli); no saved bill, line or movement changed; at most 4 axes; Hindi screen text out of scope, Hindi search names in.

**Scale/Scope**: 5,000 items at launch growing to 50,000 variants; about 200 shades with formulas; roughly 10 new screens or dialogs (family form, variant grid, names and barcodes panel, merge, data issues, tint picker, shade library, tint charges, import preview, labels).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle                                     | How this plan satisfies it                                                                                                                                                                                        | Status                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| I. Saved bill versions never altered          | Tinted lines, colorant movements and `bill_line_tint` snapshots are written in the bill transaction; formulas used on a bill are frozen and changed by a new version; merges never rewrite `bill_line.variant_id` | Pass                       |
| II. Stock and balances from immutable records | Merges and their reversal are `merge_out` and `merge_in` movements; colorant use is `sale` movements; `item_sales_stat` is a rebuildable projection with a test                                                   | Pass                       |
| III. Integers                                 | Conversions use `factor_milli`; inexact conversions are rejected; colorant ml in thousandths; tint cost rounded half up once in `money.ts`                                                                        | Pass                       |
| IV. Offline-first                             | Search index local, in memory; no network                                                                                                                                                                         | Pass                       |
| V. UI-free core                               | All rules listed in data-model "Derived values" live in `packages/core`                                                                                                                                           | Pass                       |
| VI. Test-first                                | Core tests and bill-writing service tests (tinted save, cancel, merge) come before code in every phase of `tasks.md`                                                                                              | Pass                       |
| VII. Simplicity                               | Generic template only, no packs (D1); in-house search and Code 128 (D4, D13); one possible package (XLSX) waits for owner approval (OD-2). V2 and V3 items (US5, FR-018, FR-019) are not planned                  | Pass                       |
| VIII. Readable names                          | Units in names (`qtyMilli`, `chargePaise`, `factorMilli`)                                                                                                                                                         | Pass                       |
| IX. Small, pure code                          | Each new screen split into folders with a hook for logic; core functions pure                                                                                                                                     | Pass                       |
| X. Design consistency                         | Every new screen checked in System, Light and Dark; labels print light; status words beside colours (for example "Merged", "Non-returnable")                                                                      | Pass                       |
| Unconfirmed facts                             | UQC codes, Tally columns, Legal Metrology on tinting, shade-card file format, label sheet size are open items OI-1 to OI-6                                                                                        | Pass (recorded)            |
| Spec conflicts with earlier decisions         | Import moved to 012 on 2026-11-15 but listed in this spec: resolved in writing as OD-1 (research D12), owner to confirm                                                                                           | Pass once OD-1 is answered |

Post-design re-check (2026-11-18): no violations. Complexity Tracking lists the additions that need a written reason.

## Project Structure

### Documentation (this feature)

```text
specs/002-items-variants-tinting/
├── plan.md              # This file
├── research.md          # D1 to D16, open items, owner decisions
├── data-model.md        # New and changed tables
├── quickstart.md        # Scenarios per milestone
├── contracts/
│   └── ipc-commands.md  # Commands added or changed
└── tasks.md             # Work list
```

### Source Code (repository root)

```text
packages/core/src/
├── catalogue/          # axisSignature.ts, variantCombinations.ts, variantGrid.ts, titleRender.ts, categoryDefaults.ts
├── units/              # unitConversion.ts
├── search/             # normaliseSearchText.ts, editDistance.ts, rankSearchMatches.ts, likelyDuplicates.ts
├── tinting/            # resolveTintFormula.ts, tintPricing.ts, tintCost.ts
├── barcode/            # code128.ts (if OD-3 is in-house)
├── import/             # itemImportRows.ts, shadeImportRows.ts (row validation, pure)
└── (existing money.ts, quantity.ts, billing.ts, stock.ts ... unchanged except new movement types)
packages/core/tests/    # one test file per module above

apps/desktop/src/main/
├── db/schema.ts                       # new tables and columns
├── repositories/                      # CatalogueRepository, FamilyRepository, BarcodeRepository, SearchNameRepository,
│                                      # PriceRepository, BatchRepository, MergeRepository, ExceptionRepository, TintRepository
├── services/
│   ├── catalogue/                     # CatalogueService (categories, brands, units)
│   ├── families/                      # FamilyService (create, generate, update, conversions, prices)
│   ├── search/                        # SearchIndex (in memory) and SearchService
│   ├── merge/                         # MergeService
│   ├── tinting/                       # TintService
│   ├── import/                        # ImportService (preview store, commit)
│   ├── labels/                        # LabelService (HTML, PDF, print)
│   └── BillingService.ts              # tinted lines, conversions, cancel by movement
└── ipc/handlers.ts                    # commands from contracts/ipc-commands.md
apps/desktop/src/renderer/features/
├── items/              # FamilyForm/, VariantPreview/, ItemNamesPanel/, MergeDialog/, DataIssues/
├── billing/            # VariantGrid/, TintPicker/, RepeatShades/
├── tinting/            # ShadeLibrary/, TintCharges/
├── import/             # ImportPreview/
└── labels/             # LabelPrint/
apps/desktop/drizzle/   # 0013 onward
apps/desktop/tests/     # integration/ and e2e/ specs for the scenarios
```

**Structure Decision**: The same two packages. Every new service and component has its own folder with `constants.ts`, `types.ts` and its tests (constitution, code layout). The renderer's `features/` folders follow 001's T088 to T090 split; if those tasks have not landed when this feature starts, they go first.

## Milestone Plan

Window 4 January to 21 February 2027 (proposed, research D16; re-date when the feature starts). Each milestone ends with its quickstart scenario passing.

| #     | Dates        | Milestone                             | Exit criteria                                                                                                                                                           |
| ----- | ------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1    | 4 to 10 Jan  | Core rules and schema                 | Core modules test-first and green; migrations 0013 onward apply to a copy of the owner's database with every 001 test still green; search benchmark run (OI-2 answered) |
| M2    | 11 to 24 Jan | Families, variants, units, grid (US1) | Quickstart 1 passes; SC-001 timed                                                                                                                                       |
| M3    | 25 to 31 Jan | Search names, duplicates, merge (US2) | Quickstart 2 passes; SC-002 and SC-006 measured                                                                                                                         |
| M4    | 1 to 14 Feb  | Tinting (US3)                         | Quickstart 3 passes; SC-003 and SC-004 measured; OI-5 answered                                                                                                          |
| M5    | 15 to 21 Feb | Paint fields, labels, import (US4)    | Quickstart 4 and 5 pass; SC-005 measured; OD-1 to OD-3 answered                                                                                                         |
| Trial | from 22 Feb  | Used at the counter                   | Owner enters the real catalogue's top families and tints for 2 weeks; top 3 complaints fixed                                                                            |

**Risks and fallbacks**

- In-house search misses 0.2 s: propose MiniSearch (OI-2), or limit fuzzy matching to the top 5,000 sellers first.
- Shade formulas are not available as a file: enter the 30 most-sold shades by hand at M4; import waits for the file.
- Owner says no to an XLSX package: CSV import only (Excel can save as CSV).
- The stock-movement rebuild (new CHECKs) is the riskiest migration: done in its own PR, tested on a copy of the real database, triggers re-created and tested.

## Complexity Tracking

| Addition                                                | Why it is needed                                                                         | Simpler alternative rejected because                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Category, attribute and brand tables (Generic template) | The long-term catalogue shape (architecture 6.2) so packs later add rows, not migrations | Fixed axis columns need a migration per product type (research D1)                 |
| In-memory search index in the main process              | 0.2 s with typos at 50,000 variants                                                      | `LIKE` and FTS5 cannot do edit distance (research D4)                              |
| Formula versions plus `bill_line_tint` snapshots        | A used formula must never change (constitution I)                                        | Editing formulas in place would change what an old bill says was mixed             |
| Enum lookup tables with a rule trigger (research D17)   | Later features add types without rebuilding append-only tables after go-live             | CHECK enums need a table rebuild per new value (four rebuilds of `stock_movement`) |
| Possible XLSX parser package (OD-2)                     | The owner's files are Excel                                                              | CSV only is the fallback if the owner declines                                     |
