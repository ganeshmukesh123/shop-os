# Data Model: Languages and Localization

Decisions in `research.md` D1 to D7.

## Text catalogues (`packages/text`, files, not database)

```
packages/text/src/
├── en.ts          # source of keys: nested object, every user-facing string
├── hi.json        # any subset of en's keys (dotted paths), Hindi text
├── translate.ts   # translate(language, key, values?) with fallback and named placeholders
├── plural.ts      # Intl.PluralRules selection for keys with { one, other }
└── missing.ts     # listMissingKeys(language) for the translator and CI
```

Key naming: `<area>.<screen or component>.<purpose>`, for example `billing.tender.changeDue` = "Change due {amount}". Error keys: `errors.<CODE>`, for example `errors.ABOVE_MRP` = "Above MRP {mrp}".

Rules:

- Placeholders are named and typed per key (`{ amount: string }`); values are formatted before translation (amounts with `formatRupees`), so translators never format numbers.
- A key with plural forms holds `{ one, other }`.
- Missing keys fall back to English and are counted.

## Database changes

| Table                    | Column          | Rule                                                                        |
| ------------------------ | --------------- | --------------------------------------------------------------------------- |
| `app_user` (005)         | `language`      | `en` default, `hi`; per user                                                |
| `shop_profile`           | `bill_language` | `en` default, `hi`; printed documents and the default for message templates |
| `message_template` (004) | `language`      | exists (`en`, `hi`)                                                         |
| `privacy_notice` (008)   | `language`      | exists                                                                      |

## Derived values

- In `@shopos/core`: `formatIndianNumber(count)`, `formatBusinessDate(date, style)`, `amountInWordsEnglish(paise)` (lakh and crore), existing `formatRupees`.
- In 002's search: `editDistance` over grapheme clusters; `splitMixedScriptWords(name)`.

Examples: `formatRupees(123456750)` gives "₹12,34,567.50"; `amountInWordsEnglish(123456750)` gives "Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Fifty Paise"; `formatBusinessDate("2027-04-01", "print")` gives "01 Apr 2027".
