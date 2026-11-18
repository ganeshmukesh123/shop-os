# Implementation Plan: Languages and Localization

**Branch**: `014-languages-localization` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-languages-localization/spec.md`, the PRD's English-first decision and NFR-012, the constitution v2.1.0, the current `strings.ts`, and the designs of 002, 004, 008 and 015.

## Summary

Move every user-facing string (screens, errors, printed documents, statements) into a small shared package of typed catalogues with English as the source and fallback; enforce it with a lint rule and a key check in CI; keep Indian number, date and amount-in-words formatting in one place; make search treat Devanagari by grapheme cluster and mixed-script names by word; bundle a Devanagari font so screens and PDFs render on every OS; then add Hindi screen text per user, with the bill language set per shop and legal wording in English until the CA agrees.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: New workspace package `@shopos/text` (no runtime dependencies). Possibly `eslint-plugin-react` for `jsx-no-literals` (OI-4, owner approval if new). One font asset: Noto Sans Devanagari (OFL, OD-2). Luxon (001 D25) for dates.

**Storage**: Catalogue files in `packages/text`; `app_user.language`, `shop_profile.bill_language`.

**Testing**: Vitest for `translate`, plurals, fallback, missing keys, formats, amount in words and grapheme edit distance; `pnpm text:check` in CI; Playwright screenshots of key screens in Hindi for layout review; print checks on three OSes.

**Target Platform**: macOS, Windows, Linux.

**Project Type**: desktop-app (pnpm workspace; plus phone apps from 010 use the same package).

**Performance Goals**: `translate` under 0.01 ms per call; no measurable change to search time (002's 0.2 s budget).

**Constraints**: Legal wording stays English (spec assumption); Western digits; no right-to-left languages.

**Scale/Scope**: About 1,500 keys across features 001 to 013 (estimate); two languages.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle             | How this plan satisfies it                                                            | Status |
| --------------------- | ------------------------------------------------------------------------------------- | ------ |
| III. Integers         | Formatting reads integer paise; no float conversion                                   | Pass   |
| V. UI-free core       | Formats stay in core; catalogues in their own pure package                            | Pass   |
| VII. Simplicity       | In-house catalogue, no i18n framework (OD-1)                                          | Pass   |
| VIII. Readable names  | Keys are readable paths (`billing.tender.changeDue`)                                  | Pass   |
| X. Design consistency | Hindi layout review on every screen; same components wrap text                        | Pass   |
| Layering (CLAUDE.md)  | Shared text package used by the renderer and the main process without crossing layers | Pass   |
| Compliance is data    | Legal wording fixed English keys until the CA approves (OI-2)                         | Pass   |

Post-design re-check (2026-11-18): no violations.

## Project Structure

### Documentation (this feature)

```text
specs/014-languages-localization/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
└── contracts/text-catalogue.md
```

### Source Code (repository root)

```text
packages/text/                 # @shopos/text: en.ts, hi.json, translate.ts, plural.ts, missing.ts, tests
packages/core/src/format/      # formatIndianNumber.ts, formatBusinessDate.ts, amountInWords.ts (money.ts unchanged)
packages/core/src/search/      # editDistance.ts over grapheme clusters (from 002), splitMixedScriptWords.ts
apps/desktop/src/renderer/     # strings.ts removed; useText() hook reads the user's language
apps/desktop/src/main/services/**Html.ts  # printed documents use translate(billLanguage, ...)
apps/desktop/resources/fonts/  # NotoSansDevanagari (OFL) with its licence file
scripts/text-check.mjs         # pnpm text:check
```

**Structure Decision**: A third shared package, because text crosses the renderer and main-process boundary and is not a business rule.

## Milestone Plan

Window 14 February to 5 March 2028 (proposed, 002 research D16).

| #   | Dates           | Milestone                                                                        | Exit criteria                                            |
| --- | --------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| M1  | 14 to 20 Feb    | Package, migration of all strings, lint and key check, Indian formats (US1, US3) | Quickstart 1 and 3; OI-1 and OI-4 answered; OD-1 decided |
| M2  | 21 to 27 Feb    | Devanagari search, font, templates (US2)                                         | Quickstart 2; OD-2 decided                               |
| M3  | 28 Feb to 5 Mar | Hindi screens per user, bill language per shop, layout review (US4)              | Quickstart 4; OI-2 and OI-3 answered                     |

**Risks and fallbacks**

- Moving every string is a big mechanical change: one PR per feature area, behaviour unchanged, checked by existing e2e tests.
- Hindi translation late: ship the mechanism with English only; Hindi when the translator finishes.

## Complexity Tracking

| Addition                | Why it is needed                               | Simpler alternative rejected because                                                  |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `@shopos/text` package  | Same text in the renderer and the main process | Keeping `strings.ts` in the renderer leaves printed documents with hard-coded English |
| Bundled Devanagari font | Linux and PDFs may lack one (research D5)      | Relying on system fonts breaks Hindi names on some machines                           |
