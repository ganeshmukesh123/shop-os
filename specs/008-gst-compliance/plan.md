# Implementation Plan: GST, Bill Formats and Compliance

**Branch**: `008-gst-compliance` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-gst-compliance/spec.md`, PRD section 11, the architecture reference sections 6.7, 8.3, 8.5, 11.1 and 11.9, the constitution v2.1.0, 001 research D19 to D23, and the designs of 002, 003, 004 and 005.

## Summary

Make every bill legally shaped for the registration in force at its instant: a Bill of Supply with the composition declaration and no tax, or a Tax Invoice with HSN, rate, taxable value and CGST and SGST (or IGST) per line, calculated from tax-inclusive prices so the total never moves. Registration and GST rates are dated rows; bills store what applied. Track financial-year turnover against the composition limit with 80% and 95% warnings. Guide a scheme switch with a checklist, a closing-stock statement, suggested prices and a new series. Capture DPDP notice and consent, withdrawal, and access and erasure requests that never alter a bill, as an early milestone before 13 May 2027. Every legal detail is a default for the CA or counsel to confirm (open items OI-1 to OI-7).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Unchanged; no new package.

**Storage**: Same SQLite file. New `registration_setting`, `hsn_rate`, `item_tax_override`, `turnover_daily`, `scheme_switch`, `privacy_notice`, `data_request`; tax columns on `bill` and `bill_line` and printed identity snapshots on `bill`; format and registration ID on `number_series`; `is_erased` on `party`.

**Testing**: Vitest test-first for every tax, rate, format, turnover and erasure rule (golden tests with the CA's worked examples once received) and for bill writes with tax; a 10,000-bill numbering test; Playwright for the quickstart.

**Target Platform**: macOS first; Windows and Linux.

**Project Type**: desktop-app (pnpm workspace).

**Performance Goals**: Tax adds under 5 ms to a 30-line bill; bill save and print still about 1 s (NFR-002); turnover status under 50 ms from the projection.

**Constraints**: Offline; integer paise; past bills never recomputed; nothing switches scheme automatically; legal defaults confirmed before use.

**Scale/Scope**: Up to 500 bills a day; about 50 HSN rate rows; 6 screens (registration and rates, turnover card, switch wizard, privacy notice, data requests, consent on the party form).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against `.specify/memory/constitution.md` v2.1.0 on 2026-11-18.

| Principle                                       | How this plan satisfies it                                                                                                                                                                   | Status              |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| I. Saved bill versions                          | Format, registration, GSTINs, rates and tax amounts are snapshots on each version; a later rate or registration change never touches a saved bill; erasure leaves bills as printed (001 D19) | Pass                |
| II. Immutable records                           | Registration and notices are append-only; turnover is a rebuildable projection                                                                                                               | Pass                |
| III. Integers                                   | Taxable value rounded once per line; CGST and SGST split in whole paise so each line sums exactly                                                                                            | Pass                |
| IV. Offline-first                               | Rates and registration are local; a missing HSN never blocks a sale                                                                                                                          | Pass                |
| V. UI-free core                                 | Tax, rate resolution, registration lookup, turnover, checklist, price suggestion, erasure in core                                                                                            | Pass                |
| VI. Test-first                                  | Golden tax tests first; bill writes with tax tested first                                                                                                                                    | Pass                |
| VII. Simplicity                                 | V2 and V3 exports, reminders and simulator not planned; tax-extra pricing not built                                                                                                          | Pass                |
| Compliance is data, confirmed by a professional | Every legal rule is a setting or a dated row; OI-1 to OI-7 for the CA and counsel; seeded rates marked unverified                                                                            | Pass (recorded)     |
| Privacy and records                             | Consent per purpose with notice version; erasure keeps legal bills; nothing deletes records                                                                                                  | Pass; OI-5 and OI-6 |
| X. Design                                       | Printed bills always light; turnover levels with words                                                                                                                                       | Pass                |

Post-design re-check (2026-11-18): no violations. The DPDP date forces milestone M0 ahead of the feature window (OD-1).

## Project Structure

### Documentation (this feature)

```text
specs/008-gst-compliance/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
└── contracts/ipc-commands.md, contracts/bill-formats.md
```

### Source Code (repository root)

```text
packages/core/src/gst/        # registration.ts, gstRate.ts, taxLine.ts, taxBill.ts, turnover.ts,
                              # switchChecklist.ts, priceSuggestion.ts, closingStock.ts
packages/core/src/privacy/    # eraseParty.ts, requestDueDate.ts
apps/desktop/src/main/
├── repositories/             # RegistrationRepository, GstRateRepository, TurnoverRepository, SwitchRepository, PrivacyRepository
├── services/gst/             # RegistrationService, TaxService (used by SaveBill and EditBill), TurnoverService, SchemeSwitchService
├── services/privacy/         # NoticeService, DataRequestService
├── services/billHtml/        # split by format: estimateHtml.ts, billOfSupplyHtml.ts, taxInvoiceHtml.ts
└── ipc/handlers.ts
apps/desktop/src/renderer/features/gst/
├── Registration/, GstRates/, TurnoverCard/, SchemeSwitchWizard/
apps/desktop/src/renderer/features/privacy/
├── ConsentTicks/ (used by party forms), PrivacyNotice/, DataRequests/
```

**Structure Decision**: Same two packages. `billHtml.ts` is split by format so each stays inside the size limits.

## Milestone Plan

Feature window 7 June to 4 July 2027 (proposed, 002 research D16), plus M0 earlier for the DPDP start date.

| #     | Dates            | Milestone                                                                    | Exit criteria                                                                   |
| ----- | ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| M0    | 3 to 12 May 2027 | Notice, consent ticks, withdrawal, access and erasure (US5 scenarios 2 to 4) | Quickstart 0; OI-5 and OI-6 answered by counsel; live before 13 May (SC-004)    |
| M1    | 7 to 13 Jun      | Core tax rules and schema                                                    | Golden tests green; OI-1 answered; migrations on a copy of the owner's database |
| M2    | 14 to 20 Jun     | Formats and dated rates (US1, US2)                                           | Quickstart 1 and 2; OI-2 and OI-3 answered; CA reviews printed samples          |
| M3    | 21 to 27 Jun     | Turnover tracker and inter-state (US3, US5 scenario 1)                       | Quickstart 3; OI-4 answered                                                     |
| M4    | 28 Jun to 4 Jul  | Switch wizard and retention (US4, US6 scenario 1)                            | Quickstart 4 and 5; OI-7 answered                                               |
| Trial | 2 weeks          | Formats at the counter                                                       | SC-001 on 50 bills; SC-003 on a rehearsal switch                                |

**Risks and fallbacks**

- The CA is slow to confirm: bills stay "Estimate" with the paper book as the legal bill (001 D23) until the CA signs off the printed samples.

- The owner switches to regular **before M2** (no registration tables yet): bills stay "Estimate" with the paper book as the legal bill (001 D23), as for a slow CA; at M2 the registration in force on that day, regular if the switch already happened, is entered with `gst.registration.setInitial`.
- The owner switches **between M2 and M4**: the switch transaction is built in M2 (T022: `gst.switch.confirm` without the wizard screens, owner-only), so the checklist is completed by hand with the CA and that command creates the `gst.registration` row and its new tax-invoice series for the same effective instant, with the wizard's prefix reservation and template checks. Until that instant billing keeps the composition registration and series. The wizard screens stay in M4.

- M0 slips past 13 May: go-live waits; consent is a legal start date, not a nice-to-have.

## Complexity Tracking

| Addition                                       | Why it is needed                                  | Simpler alternative rejected because                                        |
| ---------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Dated registration with an instant, not a date | A switch in the middle of a day (spec edge case)  | A date alone mis-formats bills between midnight and the switch time         |
| Dated `hsn_rate` plus dated overrides          | Rate changes are data (NFR-016, architecture 6.7) | A rate column on each item needs editing thousands of items on every change |
| Number series per registration and format      | A new series at a scheme switch (US1 scenario 5)  | One series cannot restart at the switch                                     |
