# Research: Languages and Localization

**Feature**: `specs/014-languages-localization/spec.md` | **Date**: 2026-11-18

Sources read: the spec, the PRD decisions of 12 November 2026 (English first), NFR-012, FR-ITM-006, FR-ITM-007, FR-KHA-007, the constitution v2.1.0 (CLAUDE.md "Keep screen text in one place so Hindi can be added later"), the current `apps/desktop/src/renderer/strings.ts` (one `uiText` object, 131 lines), `packages/core/src/money.ts` (`formatRupees` with Indian grouping already), 001 research D25 (Luxon), and the plans of 002 (search normalisation), 004 (Hindi and English message templates), 008 (legal wording, notices in two languages) and 015 (receipt printing).

**Build window**: 14 February to 5 March 2028 (002 research D16). The separation rule (US1) and Indian formats (US3) already apply to every feature from 001; this feature makes them complete and enforced, then adds Hindi.

## Decisions

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:1f2292038bb4710ff852954f6991d8e73bfe3ac4e93c351559044f94520e303e -->

### D1. Text catalogues in a small shared package, typed by the English source

- **Decision**: a new workspace package `packages/text` (`@shopos/text`, pure TypeScript, no runtime dependencies) holds the catalogues and a `translate(language, key, values)` function. `en.ts` is the source of keys (a typed object like today's `uiText`); other languages are JSON files (`hi.json`) holding any subset of keys. Discover these files by filename at build time so a new catalogue requires no code changes or manual registration (SC-001). Missing keys fall back to English and are reported (FR-001, FR-007).
- **Why a package**: the renderer shows screen text and the main process renders printed bills, statements and messages (001, 004, 008). Both need the same catalogue, and the layering rules forbid the renderer importing main-process code and vice versa. `packages/core` is for business rules; text is not one, so it gets its own package rather than growing core.
- **Placeholders**: named, `{customerName}` and `{amount}`, so word order can change per language (US1 scenario 4). Plurals with the built-in `Intl.PluralRules` (`one`, `other` keys). No ICU message syntax beyond that.
- **Alternatives**:

| Option                            | Fit                                              | Why not chosen                                                                      |
| --------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| i18next with react-i18next        | Mature, ICU plugin                               | Two packages; runtime loading features the app does not need; owner approval needed |
| FormatJS (react-intl)             | Full ICU MessageFormat, standard                 | Heavier; ICU syntax is more than translators of this shop need                      |
| In-house typed catalogue (chosen) | Already the shape of `uiText`; type-checked keys | About 100 lines to write and test                                                   |

- **Owner decision OD-1**: confirm the in-house catalogue (or choose FormatJS if more languages with complex grammar are expected soon).

### D2. The main process sends codes, the renderer shows text

Every IPC error result already carries a stable `code` (001 contract). The renderer maps codes to text through the catalogue (`errors.<CODE>`); the main process's `message` field stays English for logs only. The main process renders printed documents and statements in the shop's bill language, subject to the legal wording rule in D6. Message templates default to the shop's bill language; selecting a template for a message uses that template's `message_template.language` instead. None of these outputs use the user's screen language.

### D3. Enforce "no hard-coded text"

- Use ESLint `react/jsx-no-literals` (from `eslint-plugin-react`, which needs owner approval if absent) in `apps/desktop/src/renderer/**` to catch direct JSX literals, allowing punctuation and symbols such as "₹", "/", ":".
- A test (`pnpm text:check`) that every key used in code exists in `en.ts`, lists keys missing per language, and fails CI if English is missing a key.
- The automated checks do not trace strings defined outside JSX into the UI. Before approving each renderer PR, the reviewer traces new or changed user-facing children and props (including accessibility labels), messages and toasts to their sources, including variables, helpers and configuration. Block approval if app-authored copy comes from a literal outside the catalogue, for example `const label = "Save"; <Button>{label}</Button>`.
- A scan of print and message templates for literal text outside the catalogue.

<!-- /coderabbit-ai-generated:v1 -->

### D4. Indian formats in one place

- Numbers: `formatRupees` and quantity display already live in `@shopos/core` (Indian grouping, 001). Add `formatIndianNumber` for plain counts. Every screen, report and print calls them; a test scans rendered report and bill output for amounts without grouping (SC-004).
- Dates: `dd-MM-yyyy` (and `dd MMM yyyy` on prints) with Luxon in the shop's zone (001 D22, D25); financial year `26-27` from 1 April (already in numbering).
- Amount in words (for tax invoices, 008): `amountInWordsEnglish` with lakh and crore ("Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Fifty Paise"). Hindi words come with the Hindi bill language, if the CA allows Hindi bills (OI-2).
- Exports (011) keep raw numbers and ISO dates in data columns; grouping is display only (FR-008).
- Digits stay Western (0 to 9) in every language unless the owner chooses otherwise (spec edge case); Devanagari digits are not offered in this release.

### D5. Devanagari in search, display and print

- **Search** (002): normalisation keeps Devanagari as typed in NFC. Edit distance is counted over **grapheme clusters** (`Intl.Segmenter`), not code units, so a vowel sign counts as part of its letter; "कोहनी" typed with one wrong matra is one edit. Mixed-script names ("Supreme कोहनी") are split into words and each part matches (spec edge case). This is a small change to 002's `editDistance`.
- **Display**: Devanagari needs a font on every OS. macOS has Kohinoor Devanagari; Windows has Nirmala UI; many Linux installs have no Devanagari font. Decision: bundle **Noto Sans Devanagari** (SIL Open Font License) as an app asset, used as the fallback in the font stack and embedded in PDFs by Chromium's print-to-PDF.
- **Receipt printers**: whether the shop's 80 mm printer prints Devanagari through the OS driver is unverified (001 D24); feature 015 decides raster printing or the English fallback with a warning.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:da0b4c499f6a2de946287a6b202dff34a3dc92b98025a1845f974db57d5fac5f -->

### D6. Screen language per user, bill language per shop

`app_user.language` (`en` default, `hi`) changes only that user's screens (FR-006); `shop_profile.bill_language` (`en` default) sets the language for printed documents and statements and the default for message templates. An explicitly selected template uses its `message_template.language` for that message (004 FR-007; this feature’s US2). The user's screen language never selects a message template or determines its rendering language. Legal wording on bills (composition declaration, document titles) stays English until the CA confirms otherwise (spec assumption, OI-2).

### D7. Hindi translation and review

A person fluent in the shop's trade translates `hi.json` from an exported list of keys with English text and context notes; the translator never edits code. Avoid fixed-width buttons. Wrapping of long Hindi labels in Radix components is unverified; check it on every screen in the Hindi layout review (OI-5, T025). Machine translation may draft but a person signs off (spec assumption).

## Open items

| ID   | Item                                                                     | Resolve by               | Milestone |
| ---- | ------------------------------------------------------------------------ | ------------------------ | --------- |
| OI-1 | Translator found and time agreed                                         | Owner                    | M1        |
| OI-2 | Whether bills, legal wording and amount in words may be printed in Hindi | CA                       | M3        |
| OI-3 | Devanagari on the shop's receipt printer                                 | 015                      | M3        |
| OI-4 | `eslint-plugin-react` already in the lint setup or to be added           | Check `eslint.config.js` | M1        |
| OI-5 | Whether Radix components wrap long Hindi labels; verify on every screen in Hindi in light and dark (T025) | Renderer maintainer | M3 |

<!-- /coderabbit-ai-generated:v1 -->

## Owner decisions needed

| ID   | Question                                     | Recommendation | Needed by |
| ---- | -------------------------------------------- | -------------- | --------- |
| OD-1 | In-house typed catalogue or FormatJS         | In-house (D1)  | M1        |
| OD-2 | Bundle Noto Sans Devanagari (OFL font asset) | Yes            | M2        |

## References

- Unicode Standard Annex #29 (grapheme clusters) and `Intl.Segmenter`: https://unicode.org/reports/tr29/ and https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter (primary).
- `Intl.PluralRules`: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules (primary).
- Unicode CLDR plural rules for Hindi: https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html (primary).
- Noto Sans Devanagari (OFL): https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari (primary vendor page).
- eslint-plugin-react `jsx-no-literals`: https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-literals.md (primary).
- Industry practice: Google's internationalisation guidance says to externalise all strings, use named placeholders, and never concatenate translated fragments (https://developers.google.com/style/translation and Android's string resources, https://developer.android.com/guide/topics/resources/localization, primary). GitHub and Shopify ship translations from per-language files keyed by a source language with fallback (Shopify Polaris i18n: https://polaris.shopify.com/, primary vendor documentation). D1 to D3 follow the same rules.
