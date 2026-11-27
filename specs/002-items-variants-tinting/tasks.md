---
description: "Task list for feature 002: item families, variants, search, merge, paint fields, labels, import and tinting"
---

# Tasks: Items - Variants, Names and Paint Tinting

**Input**: Design documents from `/specs/002-items-variants-tinting/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-commands.md, quickstart.md. Feature 001 phase 7 (T073 to T090) merged.

**Tests**: Included and written first. Constitution VI requires tests before code for `packages/core` and for anything that writes bills, stock or ledger (tinted bills, merges, conversions on bills). Each test task must fail before its implementation task starts.

**Organization**: One phase per user story in spec priority order (US1, US2, US3 are P1; US4 is P2). US5 (V2, V3 and Later items: kits, substitutes, ISI capture, colorant alerts, item notes, machine import) is **not planned**: constitution VII keeps V2 and later items out until their own spec starts.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US4
- `core` = `packages/core`, `desktop` = `apps/desktop`. Every service and component folder holds its `constants.ts`, `types.ts` and tests.

---

## Phase 1: Setup

- [ ] T001 Confirm 001 tasks T073 to T090 are merged on `main`; if any is open, finish it first and note it in `specs/002-items-variants-tinting/plan.md` under Milestone Plan
- [ ] T002 Ask the owner OD-1 to OD-4 in `specs/002-items-variants-tinting/research.md` and write each answer and its date under "Owner decisions needed"
- [ ] T003 [P] Create empty module folders with `index.ts` barrels: `core/src/catalogue/`, `core/src/units/`, `core/src/search/`, `core/src/tinting/`, `core/src/import/`, and export them from `core/src/index.ts`

---

## Phase 2: Foundational (M1, 4 to 10 Jan 2027)

**Purpose**: Core rules and schema every story needs. No story starts before this phase is done.

### Core rules, tests first

- [ ] T004 [P] Write tests in `core/tests/catalogue/axisSignature.test.ts`: keys sorted, `key=value` joined by `|` (for `{ size: "0.5 in", class: "4 kg" }` the signature is `class=4 kg|size=0.5 in`), empty axes give `''`, values trimmed, unknown keys rejected; `base_type` and `pack_size` are valid keys
- [ ] T005 [P] Write tests in `core/tests/catalogue/variantCombinations.test.ts`: 3 sizes x 2 classes give 6 combinations in grid order; 5 axes rejected with `TOO_MANY_AXES` and the message "A family can have at most 4 variant attributes"; the 8 Generic keys (size, gauge, shade, pack_size, colour, length, rating, brand) plus `class` and `base_type` are accepted; unknown keys give `UNKNOWN_ATTRIBUTE`
- [ ] T006 [P] Write tests in `core/tests/units/unitConversion.test.ts`: 2 rolls at `factor_milli` 90000 give 180000 milli; 0.33 roll at 90000 gives 29700 milli (29.7 m); 0.333 roll at 90500 gives `INEXACT_CONVERSION`; 0.5 box of 10 pcs gives 5000 milli; a factor of 0 or below is rejected; results above the safe integer limit are rejected
- [ ] T007 [P] Write tests in `core/tests/search/normaliseSearchText.test.ts` and `core/tests/search/editDistance.test.ts`: NFC, lower case, Latin diacritics removed, Devanagari kept; Damerau-Levenshtein "elbow"/"elbwo" = 1, "paipa"/"pipe" = 2; `editDistanceWithin` stops early above the limit
- [ ] T008 [P] Write tests in `core/tests/search/rankSearchMatches.test.ts`: tier order exact barcode or code, whole word, prefix, fuzzy (distance 1 for 4 to 7 characters, 2 for 8 or more); within a tier more `bill_count_90d` first; a multi-variant family appears once as a family row
- [ ] T009 [P] Write tests in `core/tests/catalogue/variantDraft.test.ts` for `validateVariantDraft`: for family kind `base_paint`, `colorant`, `paint` or `thinner_solvent`, `petroleum_class`, `declared_qty_milli` and `declared_uom` are required (`MISSING_PAINT_FIELDS`); `sealed_pack_only` with `allow_decimal` 1 gives `SEALED_PACK_DECIMAL`; `warranty_months` 0 to 120; `trade_label` up to 20 characters; `location_tag` up to 30
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:4b556ec42d1b098d48d359a0c95989442e38916889d7f1864283463d126415f4 -->

- [ ] T089 [US1] Add FR-002 boundary tests to `core/tests/catalogue/variantCombinations.test.ts` after T005: 10 × 10 × 5 axis values generate all 500 combinations; 10 × 10 × 6 axis values are refused with `TOO_MANY_COMBINATIONS` and the requested count (600) in the error message.
- [ ] T010 [P] Implement `core/src/catalogue/axisSignature.ts` and `core/src/catalogue/variantCombinations.ts` to pass T004 and T005; enforce FR-002’s 500-combination limit to pass T089

<!-- /coderabbit-ai-generated:v1 -->

- [ ] T011 [P] Implement `core/src/units/unitConversion.ts` (`convertToBaseMilli`) to pass T006
- [ ] T012 [P] Implement `core/src/search/normaliseSearchText.ts` and `core/src/search/editDistance.ts` to pass T007
- [ ] T013 Implement `core/src/search/rankSearchMatches.ts` to pass T008 (depends on T012)
- [ ] T014 [P] Implement `core/src/catalogue/variantDraft.ts` to pass T009
- [ ] T015 Add new movement types `merge_in` and `merge_out` to `core/src/stock.ts` with tests in `core/tests/stock.test.ts` (signed quantity follows the locations, as 001)

### Schema and migrations (tests on a copy of real data)

- [ ] T016 Add catalogue tables to `desktop/src/main/db/schema.ts`: `category` (name 1-80 trimmed, unique among siblings case-insensitive; `default_hsn` 4, 6 or 8 digits), `attribute_def` (8 Generic keys plus `class` and `base_type`), `brand` (name 1-60, unique per business case-insensitive), `uom` (seeded rows of data-model.md), then run `pnpm --filter @shopos/desktop db:generate` (migration 0015)
- [ ] T017 Add family and variant columns to `desktop/src/main/db/schema.ts`: `item_family.kind` (`general` default, `base_paint`, `colorant`, `paint`, `thinner_solvent`), `category_id`, `brand_id`, `spec` (JSON, default `{}`), `axis_keys` (JSON array, `json_array_length(axis_keys) <= 4`); `item_variant.axes`, `axis_signature` (`UNIQUE(family_id, axis_signature)`), `purchase_price_paise`, `reorder_level_milli`, `location_tag`, `petroleum_class` (`A`,`B`,`C`,`NA`, default `NA`), `declared_qty_milli` with `declared_uom` (both null or both set), `trade_label`, `sealed_pack_only` (CHECK `sealed_pack_only = 0 or allow_decimal = 0`), `warranty_months` (0-120), `is_serial_tracked`, `merged_into_id` (CHECK `merged_into_id <> id`); generate migration 0016 that sets 001 rows to kind `general`, axes `{}`, signature `''`
- [ ] T018 Add `unit_conversion` (`factor_milli > 0`, `UNIQUE(variant_id, uom_code)`), `item_barcode` (index on `code`, not unique; `UNIQUE(variant_id, code)`), `item_search_name` (`UNIQUE(variant_id, name)` case-insensitive), `price_tier` (seed `retail` default, `contractor`, `dealer`), `item_price` (`UNIQUE(variant_id, tier_id)`), `item_batch` (`mrp_paise > 0`, index `(variant_id, received_at)`), `item_sales_stat` to `desktop/src/main/db/schema.ts`; migration 0017 copies any non-null `item_variant.barcode` into `item_barcode` with source `manufacturer`
- [ ] T019 Rebuild `stock_movement` and `bill_tender` once in migration 0018 (hand-edited SQL in `desktop/drizzle/`, research D17): create the lookup tables of `data-model.md` (`movement_type` with `direction`, `requires_doc`, `requires_reason`; `movement_doc_type`; `tender_mode`; `tender_status`; `exception_kind`); turn the enum columns into foreign keys; replace 001's movement CHECKs with one rule trigger that reads `movement_type`; add the rows `merge_in`, `merge_out` and doc type `item_merge`; test that inserting a new lookup row (for example `transfer` with direction `both`) needs no rebuild; new nullable `batch_id`; copy every row; re-create the append-only triggers; `location.kind` adds `tinted_returns` and a "Tinted returns" row is seeded per shop
- [ ] T020 Add `item_merge_log` (append-only triggers; `action` `merge` or `reverse`; `merge_log_id` unique), `exception_event` (status `open` to `resolved` only, by trigger), tinting tables `tint_shade`, `tint_formula` (`UNIQUE(shade_id, base_variant_id, version)`; no `is_current` column: the current formula is the highest version), `tint_formula_line` (`qty_milli > 0`), `tint_charge_rule`, `tint_shade_price`, and `bill_line` columns `entered_uom`, `qty_entered_milli`, `tint_formula_id`, `tint_charge_paise`, `cost_paise`, `is_returnable` (default 1), plus `bill_line_tint` (append-only) in migration 0019; trigger blocking UPDATE or DELETE of a `tint_formula` or its lines once a `bill_line` points at it; also block INSERT of a line into a used formula and UPDATE that moves a line into a used formula. Allow inserts into unused versions
- [ ] T021 Write `desktop/tests/integration/migrations002.test.ts`: apply 0015 to 0019 to a database seeded like 001 (items, bills, cancelled bill, movements); every item is a one-variant family with the same id, code and stock; every bill and line is unchanged byte for byte; triggers reject UPDATE and DELETE on `stock_movement`, `bill_line_tint`, `item_merge_log`; INSERT of a new colorant line into a used formula fails even with a distinct colorant, and the same insert into an unused formula version succeeds
- [ ] T022 Run the migrations on a backup copy of the owner's database (restored with the backup API, never a copied live file) and record the result in `specs/002-items-variants-tinting/research.md` under D14

### Search index and benchmark

- [ ] T023 Write tests in `desktop/src/main/services/search/SearchIndex.test.ts`: build from repositories, update on create, rename, deactivate and merge, query uses `rankSearchMatches`
- [ ] T024 Implement `desktop/src/main/services/search/SearchIndex.ts` and `SearchService.ts` (in-memory, built at start in `desktop/src/main/app/startApp.ts`)
- [ ] T025 Write the benchmark `desktop/tests/integration/searchBenchmark.test.ts`: 50,000 generated variants with 2 search names each, 50 queries including typos; record median and 95th percentile in `specs/002-items-variants-tinting/research.md` under OI-2

**Checkpoint (M1 exit)**: core green; migrations proven on real data; OI-2 answered.

---

## Phase 3: User Story 1 - Item families with variants (M2, 11 to 24 Jan; P1) MVP

**Goal**: Create a family with up to 4 axes, generate and prune combinations, set units and conversions, bill from a grid.

**Independent Test**: quickstart scenario 1 (3 sizes x 2 classes, 6 variants, delete 1, bill 2 from the grid).

### Tests first

- [ ] T026 [P] [US1] Write tests in `core/tests/catalogue/variantGrid.test.ts`: axis 1 rows, axis 2 columns, axes 3 and 4 as tabs, missing combinations are empty cells, inactive cells marked
- [ ] T027 [P] [US1] Write tests in `core/tests/catalogue/titleRender.test.ts` and `core/tests/catalogue/categoryDefaults.test.ts`: `{brand} {size} {class}` renders "Supreme 0.5 in 4 kg"; missing values are skipped without double spaces; a child category inherits empty defaults from its nearest ancestor
- [ ] T028 [P] [US1] Write tests in `desktop/src/main/services/families/FamilyService.test.ts`: create with 5 of 6 combinations; `DUPLICATE_SIGNATURE`; opening stock writes one `opening` movement per variant; deactivate never deletes; a variant on a saved bill can be deactivated and the bill still reads it
- [ ] T029 [P] [US1] Write tests in `desktop/tests/integration/billConversion.test.ts`: `bills.save` with `enteredUom` `roll` stores `entered_uom`, `qty_entered_milli` 2000 and `qty_base_milli` 180000, and deducts 180 m; 0.33 roll at 90000 stores 330 entered and 29700 base milli and deducts 29.7 m; 0.333 roll on a separate variant at 90500 fails with `INEXACT_CONVERSION` and writes nothing; `UNKNOWN_UNIT` when no conversion exists

### Implementation

- [ ] T030 [P] [US1] Implement `core/src/catalogue/variantGrid.ts`, `titleRender.ts`, `categoryDefaults.ts` to pass T026 and T027
- [ ] T031 [US1] Add Zod schemas and command types for `catalogue.*`, `families.*` and `variants.*` (first table of `contracts/ipc-commands.md`) in `core/src/commands.ts` and `core/src/types.ts`
- [ ] T032 [P] [US1] Implement `desktop/src/main/repositories/CatalogueRepository.ts` (categories, brands, units) and `FamilyRepository.ts` (families, variants, conversions, prices, batches)
- [ ] T033 [US1] Implement `desktop/src/main/services/catalogue/CatalogueService.ts` and `desktop/src/main/services/families/FamilyService.ts` to pass T028
- [ ] T034 [US1] Extend `desktop/src/main/services/BillingService.ts` for entered units to pass T029 (conversion via `convertToBaseMilli`, both quantities stored)
- [ ] T035 [US1] Register the commands in `desktop/src/main/ipc/handlers.ts` and the bridge in `desktop/src/preload/bridge.ts`
- [ ] T036 [P] [US1] Build `desktop/src/renderer/features/items/FamilyForm/` (name, kind, category, brand, axis picker limited to 4 with the reason shown) and `VariantPreview/` (combination table with tick boxes, price and opening quantity per row), with a `useFamilyForm` hook holding the logic
- [ ] T037 [P] [US1] Build `desktop/src/renderer/features/items/UnitConversions/` (alternate units and factors, live example "1 roll = 90 m")
- [ ] T079 [US4] After T036 and before US3, add paint fields (petroleum class, declared quantity and unit, trade label, sealed pack only), warranty months and serial tracking to `desktop/src/renderer/features/items/FamilyForm/`, with paint fields required for every non-general kind with the message "Petroleum class is required for paint, thinner and solvent items"
- [ ] T038 [US1] Build `desktop/src/renderer/features/billing/VariantGrid/` (Radix Table, arrow keys, Enter adds; stock shown with a word for negative stock) and open it from the bill search when a family row is chosen
- [ ] T039 [US1] Add a unit selector to the bill line in `desktop/src/renderer/features/billing/` that lists the base unit and the variant's conversions; show "2 roll (180 m)"
- [ ] T040 [US1] Write the e2e spec `desktop/tests/e2e/families.spec.ts` for quickstart scenario 1 and time SC-001 (family with 6 variants in under 2 minutes)

**Checkpoint**: US1 works alone; quickstart 1 passes.

---

## Phase 4: User Story 2 - Find items by any name and avoid duplicates (M3, 25 to 31 Jan; P1)

**Goal**: Several names per item, typo-tolerant ranked search, duplicate warnings, duplicate-barcode chooser, reversible merge.

**Independent Test**: quickstart scenario 2.

### Tests first

- [ ] T041 [P] [US2] Write tests in `core/tests/search/likelyDuplicates.test.ts`: same brand, category and signature flags; names within distance 2 or sharing 60% of trigrams flag; different brand and different name do not
- [ ] T042 [P] [US2] Write tests in `desktop/src/main/services/merge/MergeService.test.ts` (writes stock, so before code): merge B (stock 4) into A (stock 10) gives A 14 and B 0 through one `merge_out` and one `merge_in` per location and batch with a non-zero balance (B with 3 on Shop floor and 1 in Godown gives two pairs), doc `item_merge`; barcodes and names move; B inactive with `merged_into_id`; bill lines unchanged; reversal within 30 days restores 10 and 4 and writes a `reverse` log row; reversal on day 31 gives `REVERSAL_WINDOW_CLOSED`; second reversal gives `ALREADY_REVERSED`; different base units give `UNIT_MISMATCH`; negative stock on B moves the other way; duplicate codes and case-insensitive names retain both original rows and metadata through reversal, while noncolliding rows move and are restored per D6; a chained merge must be reversed newest first (`SURVIVOR_MERGED`); A's oldest-batch lookup includes B's reassigned batch with its original MRP, and reversal restores ownership to B
- [ ] T043 [P] [US2] Write tests in `desktop/tests/integration/barcodeLookup.test.ts`: one code on two variants returns both and logs one `duplicate_barcode` exception (not one per scan); after B is merged into A and A into C, B's retained code returns C (the survivor rule follows every merge)

### Implementation

- [ ] T044 [P] [US2] Implement `core/src/search/likelyDuplicates.ts` to pass T041
- [ ] T045 [P] [US2] Implement `desktop/src/main/repositories/BarcodeRepository.ts`, `SearchNameRepository.ts`, `ExceptionRepository.ts`
- [ ] T046 [US2] Implement `desktop/src/main/services/merge/MergeService.ts` and `desktop/src/main/repositories/MergeRepository.ts` (one transaction per merge or reversal) to pass T042
- [ ] T047 [US2] Implement `items.search`, `items.lookupBarcode`, `items.checkDuplicates`, `items.merge`, `items.merge.reverse`, `items.merge.list`, `exceptions.list`, `exceptions.resolve`, `variants.setBarcodes`, `variants.setSearchNames` in `desktop/src/main/ipc/handlers.ts` with schemas in `core/src/commands.ts`; make the item history and stock views follow `merged_into_id`
- [ ] T048 [US2] Update `item_sales_stat` inside the bill-save and cancel transactions in `desktop/src/main/services/BillingService.ts`; add `rebuildItemSalesStats` with a test that the rebuilt table equals the incremental one
- [ ] T049 [P] [US2] Build `desktop/src/renderer/features/items/ItemNamesPanel/` (search names with language and kind; barcodes with source; "shared with" warning)
- [ ] T050 [P] [US2] Show likely duplicates in `FamilyForm/` before save (list with the reason, "Save anyway" and "Open existing")
- [ ] T051 [P] [US2] Build `desktop/src/renderer/features/items/MergeDialog/` (pick survivor, preview stock and history moved, reason required; merge log list with "Reverse" until the window closes and the days left)
- [ ] T052 [P] [US2] Build `desktop/src/renderer/features/items/DataIssues/` (open and resolved, resolve with a note) and the barcode chooser dialog in billing
- [ ] T053 [US2] Write the e2e spec `desktop/tests/e2e/searchMerge.spec.ts` for quickstart scenario 2; measure SC-002 (50-search trial, 95% found) and SC-006

**Checkpoint**: US1 and US2 work; quickstart 2 passes.

---

## Phase 5: User Story 3 - Bill tinted paint (M4, 1 to 14 Feb; P1)

**Goal**: Shades, formulas, colorants in ml, tinting charge or shade price, custom shades, repeat shades, non-returnable lines.

**Independent Test**: quickstart scenario 3.

### Tests first

- [ ] T054 [P] [US3] Write tests in `core/tests/tinting/resolveTintFormula.test.ts`: picks the base variant for product, base type and pack; returns the current formula; `NO_FORMULA` when none; `NOT_A_BASE` for a non-base variant
- [ ] T055 [P] [US3] Write tests in `core/tests/tinting/tintPricing.test.ts` and `tintCost.test.ts`: ₹1,450.00 + ₹60.00 = ₹1,510.00; a shade price ₹1,550.00 wins and adds no charge; cost = base purchase price + colorant price per ml x ml, rounded half up once (Blue at ₹2.40 per ml x 12.5 ml = ₹30.00)
- [ ] T056 [P] [US3] Write tests in `desktop/tests/integration/tintedBill.test.ts` (bill-writing, before code): one transaction writes the base line with `tint_formula_id`, `tint_charge_paise`, `cost_paise`, `is_returnable` 0, one `bill_line_tint` row per colorant, one `sale` movement for the base and one per colorant; retry with the same `clientBillId` writes nothing new; base out of stock still saves and is listed in `negativeStockItems`; an ordinary sale using a superseded formula gives `FORMULA_NOT_CURRENT`; a current formula for a different base gives `FORMULA_BASE_MISMATCH` with no writes; a repeat using a saved `sourceBillLineId` after supersession uses the original formula ID and colorant snapshots for the new bill and movements; a repeat with a different base gives `FORMULA_BASE_MISMATCH`, and an invalid source gives `INVALID_TINT_REPEAT_SOURCE`, both with no writes After the base and a colorant are merged into survivors, a repeat on the survivor base succeeds and posts the colorant movement on the colorant's survivor.
- [ ] T057 [P] [US3] Write tests in `desktop/tests/integration/cancelByMovement.test.ts`: cancelling a tinted bill writes one `sale_cancel` per `sale` movement (base and colorants), so stock returns exactly; a 001 bill still cancels as before
- [ ] T058 [P] [US3] Write tests in `desktop/src/main/services/tinting/TintService.test.ts`: saving a changed formula already used on a bill creates version 2 and leaves version 1's row unchanged; the current formula is version 2 because it is the highest; the trigger rejects a direct UPDATE of a used formula line; custom shade needs a customer or site label (`LABEL_REQUIRED`); repeat list for "sharma" matches "Sharma" newest first and includes `sourceBillLineId` for billed shades

### Implementation

- [ ] T059 [P] [US3] Implement `core/src/tinting/resolveTintFormula.ts`, `tintPricing.ts`, `tintCost.ts` to pass T054 and T055
- [ ] T060 [US3] Implement `desktop/src/main/repositories/TintRepository.ts` and `desktop/src/main/services/tinting/TintService.ts` to pass T058
- [ ] T061 [US3] Extend `desktop/src/main/services/BillingService.ts` and `desktop/src/main/repositories/BillRepository.ts` for tinted lines to pass T056
- [ ] T062 [US3] Change cancel in `desktop/src/main/services/BillingService.ts` to reverse every `sale` movement of the bill, to pass T057
- [ ] T063 [US3] Register `tint.*` commands in `desktop/src/main/ipc/handlers.ts` with schemas in `core/src/commands.ts`
- [ ] T064 [P] [US3] Build `desktop/src/renderer/features/billing/TintPicker/` (product, shade search, pack; colorant amounts in a large readable list for the tinter; price breakdown; "No formula for this pack" with "Custom shade")
- [ ] T065 [P] [US3] Build `desktop/src/renderer/features/billing/RepeatShades/` (shown when a customer name is entered; one tap adds "same as last time")
- [ ] T066 [P] [US3] Build `desktop/src/renderer/features/tinting/ShadeLibrary/` (shades, formula versions, custom shades) and `TintCharges/` (charge per pack size)
- [ ] T067 [US3] Show "Non-returnable (tinted)" on the bill view and printed bill in `desktop/src/main/services/billHtml.ts` and print the colorant lines under the base line (update `specs/001-shop-os-mvp/contracts/bill-layout.md` with a "Tinted line" section); verify the saved flag and the seeded location for FR-017. The owner-approved reduced-value return is deferred to 003 FR-015 with 005 approvals
- [ ] T068 [US3] Write the e2e spec `desktop/tests/e2e/tinting.spec.ts` for quickstart scenario 3 steps 1 to 5; script step 6 (20 sales, SC-004) as an integration test in `desktop/tests/integration/tintStockAccuracy.test.ts`; time SC-003
- [ ] T069 [US3] Record OI-5 (shade-card file format) in `specs/002-items-variants-tinting/research.md` from the owner's real file

**Checkpoint**: US1 to US3 work; quickstart 3 passes.

---

## Phase 6: User Story 4 - Paint class, warranty and serial flags, labels and import (M5, 15 to 21 Feb; P2)

**Goal**: Barcode labels and shelf tags, plus item and shade import with preview. Paint, warranty and serial controls land in T079 during M2.

**Independent Test**: quickstart scenario 4.

### Tests first

- [ ] T070 [P] [US4] Write tests in `core/tests/import/itemImportRows.test.ts`: maps columns to family, axes, unit, price, opening quantity, HSN (4, 6 or 8 digits), paint fields; reports missing unit, bad HSN, bad number, missing paint fields with row and column; groups duplicate rows by `findLikelyDuplicates`
- [ ] T071 [P] [US4] Write tests in `core/tests/import/shadeImportRows.test.ts`: shade code, name, brand, base type, pack, colorant, ml; unknown colorant and non-positive ml reported
- [ ] T072 [P] [US4] If OD-3 is in-house: write tests in `core/tests/barcode/code128.test.ts` against known encodings (checksum and bar pattern for `ITM-0042` and three more strings from ISO/IEC 15417 examples)
- [ ] T073 [P] [US4] Write tests in `desktop/src/main/services/import/ImportService.test.ts`: preview saves nothing; commit refuses `PREVIEW_HAS_ERRORS` unless error rows are excluded; commit is one transaction; running the same file twice finds every row as a duplicate and creates nothing new; shade preview returns the `previewId` used by shade commit

### Implementation

- [ ] T074 [P] [US4] Implement `core/src/import/itemImportRows.ts` and `shadeImportRows.ts` to pass T070 and T071
- [ ] T075 [P] [US4] Implement `core/src/barcode/code128.ts` to pass T072 (or add the approved package under OD-3 and write the same tests against it)
- [ ] T076 [US4] Implement `desktop/src/main/services/import/ImportService.ts` (CSV reader; XLSX reader only if OD-2 approves a package; previews kept in memory for 30 minutes) to pass T073; record the Tally column map in `specs/002-items-variants-tinting/research.md` under OI-3
- [ ] T077 [US4] Implement `desktop/src/main/services/labels/LabelService.ts` (HTML for 65-up sheets 38.1 x 21.2 mm and a single label; shelf tag with name, price, unit price per litre or kg from the declared quantity, location tag) rendered through `desktop/src/main/services/electronRenderer.ts`; record the sheet size under OI-6
- [ ] T078 [US4] Register `import.*` and `labels.*` commands in `desktop/src/main/ipc/handlers.ts` with schemas in `core/src/commands.ts`
- [ ] T080 [P] [US4] Build `desktop/src/renderer/features/import/ImportPreview/` (rows OK, errors with row and column, duplicate groups, missing units; confirm button disabled until errors are excluded)
- [ ] T081 [P] [US4] Build `desktop/src/renderer/features/labels/LabelPrint/` (pick items, layout, kind; export PDF or print)
- [ ] T082 [US4] Write the e2e spec `desktop/tests/e2e/importLabels.spec.ts` for quickstart scenario 4; measure SC-005 with a generated 3,000-row file; scan 10 printed labels with a USB scanner (manual, result in `specs/002-items-variants-tinting/research.md`); cover shade-file preview and confirmation in scenario 4 step 5

**Checkpoint**: all four stories work; quickstart 4 passes.

---

## Phase 7: Polish and cross-cutting

- [ ] T083 [P] Check every new screen in System, Light and Dark against `docs/design/design-guidelines.md`'s new-screen checklist (quickstart scenario 5); labels and bills print black on white
- [ ] T084 [P] Move every new screen string into `desktop/src/renderer/strings.ts` (Hindi later, feature 014)
- [ ] T085 [P] Update `docs/reference/architecture.md` only where this feature deviates (Generic template only, merge by pointer, cancel by movement) with a dated note
- [ ] T086 Update `specs/001-shop-os-mvp/data-model.md` "Target shape" to point to this feature's data model for the item, stock and bill-line columns it added
- [ ] T087 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`; fix size and naming warnings in new files
- [ ] T088 Counter trial from 22 Feb 2027: owner enters the top families and the 30 most-sold shades; record SC-001 to SC-006 results and the top 3 complaints in `specs/002-items-variants-tinting/plan.md`

---

## Dependencies and execution order

```
Phase 1 Setup --> Phase 2 Foundational (M1) --> US1 (M2) --> US2 (M3)
                                                 |
                                                 +--> US3 (M4) --> US4 (M5) --> Polish
```

- US1 is needed by US2 (names and merge act on variants) and US3 (base paints and colorants are families).
- US2 and US3 do not depend on each other after US1; done in that order by one builder.
- US3 requires the T017 paint schema and the T079 FamilyForm controls from M2 (after T036) to create base paint and colorant variants.
- Within each story: tests, then core, then repositories and services, then commands, then screens, then e2e.

## Parallel examples

- Phase 2: T004 to T009 (six test files) together; then T010, T011, T012, T014 together.
- US1: T026, T027, T028, T029 together; then T036 and T037 together.
- US3: T054 to T058 together; then T064, T065, T066 together.

## Implementation strategy

1. MVP slice: Phase 1, Phase 2, US1. The shop can enter variant families and bill from the grid; stop and use it.
2. Add US2 (search and merge), then US3 (tinting); each is used at the counter before the next starts.
3. Finish US4 with labels and import after US3; the paint field controls are already available from M2. Labels and import come when the owner's files (OI-3, OI-5, OI-6) are in hand.
4. One concern per pull request: the stock-movement rebuild (T019) is its own PR.
