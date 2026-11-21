# Contract: text catalogue and language settings

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:d4734f072a53f86fdd40218ef7128f0d19e966bee09674de013be665ac6558b4 -->

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
declare function exportForTranslator(language: LanguageCode): { key: TextKey; english: string; current?: string; note?: string }[];
```

`TextKey` is generated from `en.ts` (a union of dotted paths), so a misspelt key fails type checking. Generate `PlaceholderValues` from the same source, mapping only keys with placeholders to their required string fields (including fields used in plural forms). For `billing.tender.changeDue`, the values must include `{ amount: string }`; omitting values or writing `{ ammount: "₹20.00" }` is a type error. Keys without placeholders take no values argument.

## Rules for every feature

1. Keep user-facing literals in the catalogue, including strings assigned outside JSX and later displayed, and text in printed documents and message templates. ESLint checks direct JSX literals; the renderer review gate in research D3 covers indirect text.
2. The renderer maps every IPC error `code` to `errors.<CODE>`; the main process's `message` is English for logs only.
3. Amounts, quantities and dates are formatted before they are passed as placeholder values.
4. Legal wording on bills uses fixed English keys under `legal.*` until the CA approves translations.

<!-- /coderabbit-ai-generated:v1 -->

## IPC commands

| Command                            | Input                                                  | Result                                            | Error codes            |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------- | ---------------------- |
| `users.setLanguage`                | `{ userId, language }` (own user, or owner for anyone) | `{ user }`                                        | `UNSUPPORTED_LANGUAGE` |
| `settings.update` (changed)        | adds `billLanguage`                                    | shop profile                                      | `UNSUPPORTED_LANGUAGE` |
| `text.missing` (owner)             | `{ language }`                                         | `{ keys[], completenessBp }`                      |                        |
| `text.exportForTranslator` (owner) | `{ language, filePath }`                               | `{ filePath }` (CSV: key, English, current, note) | `WRITE_FAILED`         |
