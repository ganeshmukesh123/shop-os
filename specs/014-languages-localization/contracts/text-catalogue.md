# Contract: text catalogue and language settings

## `@shopos/text` API

```ts
// LanguageCode includes English and codes discovered from bundled catalogue filenames.
type TranslateArgs = {
  [Key in TextKey]: Key extends keyof PlaceholderValues
    ? [key: Key, values: PlaceholderValues[Key]]
    : [key: Key];
}[TextKey];

declare function translate(language: LanguageCode, ...args: TranslateArgs): string;
// Returns the language's text, else English; replaces {name} placeholders; never throws for a missing key in non-English.

declare function listMissingKeys(language: LanguageCode): TextKey[];
declare function exportForTranslator(
  language: LanguageCode,
): { key: TextKey; english: string; current?: string; note?: string }[];
```

`TextKey` is generated from `en.ts` (a union of dotted paths), so a misspelt key fails type checking. Generate `PlaceholderValues` from the same source, mapping only keys with placeholders to their required string fields (including fields used in plural forms). For `billing.tender.changeDue`, the values must include `{ amount: string }`; omitting values or writing `{ ammount: "₹20.00" }` is a type error. Keys without placeholders take no values argument. A plural key (its entry holds `{ one, other }`) always maps to at least `{ count: number }`, even when its text has no other placeholder, and `translate` picks the form with `new Intl.PluralRules(resolvedLanguage).select(count)`, where `resolvedLanguage` is the language of the entry actually used (English when the key falls back), so a missing Hindi entry with `count` 0 gives English "0 items", not "0 item". `count` is the one placeholder that is a number, not a string: it selects the form, and where the text shows `{count}` it is formatted with `formatIndianNumber` ("1,250 items"). Example: `translate("hi", "billing.draft.lineCount", { count: 2 })` picks `other`.

## Rules for every feature

1. Keep user-facing literals in the catalogue, including strings assigned outside JSX and later displayed, and text in printed documents and message templates. ESLint checks direct JSX literals; the renderer review gate in research D3 covers indirect text.
2. The renderer maps every IPC error `code` to `errors.<CODE>`; the main process's `message` is English for logs only. An error whose text needs values carries them raw on the result, `{ ok: false, code, message, values? }`, for example `ABOVE_MRP` with `values: { mrpPaise: 15000 }`. The renderer formats them (`formatRupees`) and passes them as the key's placeholders (`{ mrp: "₹150.00" }`). `values` is an addition to 001's result shape; results without it are unchanged. **`INVALID_FIELD` keeps its field-specific guidance**: such results also carry `values.reason`, a key under `errors.INVALID_FIELD.*` (for example `sequenceBelowOne`, `businessDateFormat`, `nameRequired`), and the renderer shows that text. Until a producer sends a reason, the renderer shows the result's `message` as is rather than one generic line, so "Name is required" never becomes "Something is wrong with this field".
3. Amounts, quantities and dates are formatted before they are passed as placeholder values.
4. Legal wording on bills uses fixed English keys under `legal.*` until the CA approves translations.

## IPC commands

| Command                            | Input                                                  | Result                                            | Error codes            |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------- | ---------------------- |
| `users.setLanguage`                | `{ userId, language }` (own user, or owner for anyone) | `{ user }`                                        | `UNSUPPORTED_LANGUAGE` |
| `settings.update` (changed)        | adds `billLanguage`                                    | shop profile                                      | `UNSUPPORTED_LANGUAGE` |
| `text.missing` (owner)             | `{ language }`                                         | `{ keys[], completenessBp }`                      |                        |
| `text.exportForTranslator` (owner) | `{ language, filePath }`                               | `{ filePath }` (CSV: key, English, current, note) | `WRITE_FAILED`         |
