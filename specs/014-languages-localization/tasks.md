---
description: "Task list for feature 014: text catalogues, Indian formats, Devanagari search and print, Hindi screens"
---

# Tasks: Languages and Localization

**Input**: Design documents from `/specs/014-languages-localization/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/text-catalogue.md, quickstart.md. Features 001 to 011 merged.

**Tests**: Included (format and translation rules first; behaviour of existing screens unchanged, checked by their e2e specs).

**Organization**: US1 and US3 (M1), US2 (M2), US4 (M3).

## Format: `[ID] [P?] [Story] Description`

`core` = `packages/core`, `text` = `packages/text`, `desktop` = `apps/desktop`.

---

## Phase 1: Setup

- [ ] T001 Ask the owner OD-1, OD-2 and OI-1; check OI-4 in `eslint.config.js`; record in `specs/014-languages-localization/research.md`
- [ ] T002 Create `packages/text` (`@shopos/text`, strict TypeScript, Vitest, no runtime dependencies) and add it to `pnpm-workspace.yaml`

---

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:4f4297d24cae7653a751a76044c3761fa63cf87462d8c56701859e955083c8dc -->

## Phase 2: Foundational

- [ ] T003 [P] Write tests in `text/tests/translate.test.ts`: English source; Hindi text when present; fallback to English for a missing key with the key counted; named placeholders in any order; type checks for valid values, missing values and misspelled fields, and calls without values for plain keys; a placeholder missing at runtime from an untyped caller is left visible as `{name}`; plural `one` and `other` with `Intl.PluralRules`
- [ ] T004 [P] Write tests in `text/tests/missing.test.ts`: `listMissingKeys("hi")` lists exactly the keys absent from `hi.json`; `exportForTranslator` gives key, English, current and note; add an unregistered `xx.json` fixture before building with the production catalogue discovery and verify that the build recognizes `xx`, renders its translations, falls back to English for omitted keys and lists them as missing, with only the JSON file added (SC-001)
- [ ] T005 Implement `text/src/translate.ts`, `plural.ts`, `missing.ts` and generate `TextKey` and placeholder value types from `en.ts`. Discover and bundle language JSON files by filename without a registration list (SC-001); pass T003 and T004
- [ ] T006 [P] Write tests in `core/tests/format/amountInWords.test.ts`, `formatIndianNumber.test.ts`, `formatBusinessDate.test.ts`: ₹12,34,567.50 in words with lakh; ₹1,00,00,000.00 as "One Crore"; zero paise omitted; 12345678 as 1,23,45,678; `01-04-2027` and `01 Apr 2027` in the shop's zone
- [ ] T007 Implement `core/src/format/*.ts` to pass T006
- [ ] T029 Add `app_user.language` and `shop_profile.bill_language` to `desktop/src/main/db/schema.ts` in an additive migration. Expose the fields through the signed-in user and shop profile read paths; test that existing records default to English and persisted language values reach both consumers.

---

## Phase 3: User Story 1 - Text kept separate from code (M1, 14 to 18 Feb 2028; P1)

- [ ] T008 [US1] Move `desktop/src/renderer/strings.ts` into `text/src/en.ts` and add a `useText()` hook in `desktop/src/renderer/shared/text/` that reads the signed-in user's language (after T029)
- [ ] T009 [US1] Replace literal text in every renderer feature folder with `useText()` keys, one PR per feature area (items, billing, khata, control, stock, delivery, gst, privacy, purchasing, reports, golive, sync), each with its e2e specs green and the D3 review gate passed
- [ ] T010 [US1] Map every IPC error `code` to `errors.<CODE>` in the renderer's shared message component; add a test that every code in `core/src/errors.ts` and the feature error lists has an English key
- [ ] T011 [US1] Move printed-document and statement text in `desktop/src/main/services/**/*Html.ts` to catalogue keys rendered with the shop's bill language (after T029); legal wording under fixed English `legal.*` keys
- [ ] T012 [US1] Turn on ESLint `react/jsx-no-literals` for `apps/desktop/src/renderer/**` (allowing punctuation and "₹") and add `scripts/text-check.mjs` as `pnpm text:check` in CI for catalogue key checks and completeness reporting; add the D3 review gate to the renderer PR checklist for user-facing text defined outside JSX
- [ ] T013 [US1] Run quickstart 1 with a test language file and record SC-001

---

<!-- /coderabbit-ai-generated:v1 -->

## Phase 4: User Story 3 - Indian formats (M1, 19 to 20 Feb; P1)

- [ ] T014 [US3] Replace every local number and date formatting in renderer and print code with `formatRupees`, `formatIndianNumber` and `formatBusinessDate`; add `amountInWordsEnglish` to 008's tax-invoice layout
- [ ] T015 [US3] Write `desktop/tests/integration/formatScan.test.ts`: render every report definition and bill layout for a fixed data set and fail on any amount of four or more digits without Indian grouping (SC-004)
- [ ] T016 [US3] Check 011's exports keep raw numbers and ISO dates in data columns (quickstart 3 step 3)

---

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:de86bbf53ca010cbaee3129beca259224023853afadd116ae051db59b965d6ad -->

## Phase 5: User Story 2 - Hindi and trade names in search and templates (M2, 21 to 27 Feb; P1)

- [ ] T017 [P] [US2] Write tests in `core/tests/search/graphemeDistance.test.ts` and `splitMixedScriptWords.test.ts`: "कोहनी" and "कोहिनी" are 1 edit apart; "Supreme कोहनी" splits into two words; Latin behaviour unchanged
- [ ] T018 [US2] Change 002's `core/src/search/editDistance.ts` to work over `Intl.Segmenter` grapheme clusters and add `splitMixedScriptWords.ts` to pass T017; re-run 002's search benchmark (0.2 s budget)
- [ ] T019 [US2] Bundle Noto Sans Devanagari in `desktop/resources/fonts/` with its OFL licence, add it to the font stack in `desktop/src/renderer/app.css` and to printed-document styles; print an A4 bill with Devanagari on macOS, Windows and Linux
- [ ] T020 [US2] Confirm 004's Hindi and English templates follow the catalogue rules (placeholders formatted first); verify the shop bill language is the default, selecting a template overrides it for that message, and screen language has no effect (D6); run 20 Hindi test sends (SC-003)
- [ ] T021 [US2] Run the 50-search trial with the owner's list (SC-002) and record it in `specs/014-languages-localization/plan.md`

---

## Phase 6: User Story 4 - Switch the screen language (M3, 28 Feb to 5 Mar; P2)

- [ ] T022 [US4] Use the language fields from T029 to implement `users.setLanguage` and `settings.update` with `billLanguage`; add `text.missing` and `text.exportForTranslator` commands, with tests for all four
- [ ] T023 [US4] Export keys for the translator; import the returned `hi.json`; `pnpm text:check` reports Hindi completeness
- [ ] T024 [P] [US4] Add a language picker to the user's profile and the bill language to Settings in `desktop/src/renderer/features/settings/`
- [ ] T025 [US4] Hindi layout review (resolve OI-5): Playwright screenshots of every screen in Hindi in light and dark; fix clipped or overflowing labels
- [ ] T026 [US4] Run quickstart 4 including SC-005 with a Hindi-speaking staff member

---

## Phase 7: Polish

- [ ] T027 Add the text rules of `contracts/text-catalogue.md` to the `shopos-react-components` and `shopos-engineering-standards` skills' checklists
- [ ] T028 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm text:check`, `pnpm build && pnpm test:e2e`

---

## Dependencies and execution order

```
Setup --> Foundational --> US1 (move text, enforce) --> US3 (formats) --> US2 (Devanagari) --> US4 (Hindi screens) --> Polish
```

T029 supplies the persisted fields and reads before T008 and T011 consume them. T022 adds the language update and translation management commands in M3 using those fields.

<!-- /coderabbit-ai-generated:v1 -->

## Parallel examples

- Phase 2: T003, T004, T006 together.
- US1: T009's PRs per feature area in parallel after T008.

## Implementation strategy

Mechanism first with English only (US1, US3); then Devanagari quality (US2); Hindi screens last, when the translation is ready.
