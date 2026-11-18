# Contract: text catalogue and language settings

## `@shopos/text` API

```ts
type LanguageCode = "en" | "hi";

translate(language: LanguageCode, key: TextKey, values?: Record<string, string>): string;
// Returns the language's text, else English; replaces {name} placeholders; never throws for a missing key in non-English.

listMissingKeys(language: LanguageCode): TextKey[];
exportForTranslator(language: LanguageCode): { key: TextKey; english: string; current?: string; note?: string }[];
```

`TextKey` is generated from `en.ts` (a union of dotted paths), so a misspelt key fails type checking.

## Rules for every feature

1. No user-facing literal in renderer JSX (ESLint `react/jsx-no-literals`), in printed-document templates or in message templates outside the catalogue.
2. The renderer maps every IPC error `code` to `errors.<CODE>`; the main process's `message` is English for logs only.
3. Amounts, quantities and dates are formatted before they are passed as placeholder values.
4. Legal wording on bills uses fixed English keys under `legal.*` until the CA approves translations.

## IPC commands

| Command                            | Input                                                  | Result                                            | Error codes            |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------- | ---------------------- |
| `users.setLanguage`                | `{ userId, language }` (own user, or owner for anyone) | `{ user }`                                        | `UNSUPPORTED_LANGUAGE` |
| `settings.update` (changed)        | adds `billLanguage`                                    | shop profile                                      | `UNSUPPORTED_LANGUAGE` |
| `text.missing` (owner)             | `{ language }`                                         | `{ keys[], completenessBp }`                      |                        |
| `text.exportForTranslator` (owner) | `{ language, filePath }`                               | `{ filePath }` (CSV: key, English, current, note) | `WRITE_FAILED`         |
