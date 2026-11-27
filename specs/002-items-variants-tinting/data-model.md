# Data Model: Items - Variants, Names and Paint Tinting

Builds on `specs/001-shop-os-mvp/data-model.md` (target shape). Conventions are unchanged: `id` UUID v7 text primary key; `business_id` and `shop_id` not null on every table; `created_at` and `updated_at` INTEGER epoch milliseconds (UTC); money `*_paise` integer; quantity `*_milli` integer thousandths of the base unit; enums are text with a CHECK. New migrations start at `0016`: feature 001 ends at `0014` (`0013` round-off and shop settings, T080; `0014` `bill_number_gap`, T083), and feature 018 adds `0015` (`shop_profile.theme`, PR #150; renumbered 2026-11-27). drizzle-kit assigns the final numbers when each migration is generated. Decisions are in `research.md` (D1 to D15).

## Overview

```
category (tree) 1--* item_family *--1 brand
                        |
                        1--* item_variant 1--* unit_conversion *--1 uom
                               |  1--* item_barcode
                               |  1--* item_search_name
                               |  1--* item_price *--1 price_tier
                               |  1--* item_batch
                               |  1--1 item_sales_stat (projection)
                               |  0..1 merged_into_id -> item_variant
item_merge_log (append-only)   exception_event (data issues)

tint_shade 1--* tint_formula 1--* tint_formula_line *--1 item_variant (colorant)
                    |  *--1 item_variant (base can)
tint_shade 1--* tint_shade_price      tint_charge_rule (per pack size)
bill_line 0..1--1 tint_formula   bill_line 1--* bill_line_tint (snapshot)
```

## Catalogue

### `category` (new)

| Field            | Rule                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------- |
| parent_id        | nullable FK to `category`; depth at most 4 (checked in the service)                     |
| name             | text 1-80, trimmed; unique among siblings, case-insensitive                             |
| default_hsn      | nullable text, 4, 6 or 8 digits                                                         |
| default_base_uom | nullable FK to `uom.code`                                                               |
| title_template   | nullable text, for example `{brand} {size} {class}` (rendered by `renderTitle` in core) |

A child inherits empty defaults from its nearest ancestor (`resolveCategoryDefaults`).

### `attribute_def` (new, seeded, system rows)

Seed the eight Generic attributes: `size`, `gauge`, `shade`, `pack_size`, `colour`, `length`, `rating`, `brand`. Also seed two axes used by the feature scenarios: `class` (label Class, `enum`, no unit kind; e.g. 4 kg and 6 kg for PVC pipe) and `base_type` (label Base type, `enum`, no unit kind; e.g. White, Pastel and Deep). Columns `key` (unique), `label`, `data_type` (`enum`, `text`, `measure`), `unit_kind` (nullable). `business_id` holds the shop's business id (the architecture's system rows with a null business id arrive with packs). This feature does not let the shop add attributes.

### `brand` (new)

`name` text 1-60, trimmed, unique per business case-insensitive.

### `uom` (new, seeded)

| code   | label      | dimension | uqc (OI-1, unverified) | allow_decimal default |
| ------ | ---------- | --------- | ---------------------- | --------------------- |
| pcs    | Pieces     | count     | NOS                    | 0                     |
| metre  | Metre      | length    | MTR                    | 1                     |
| kg     | Kilogram   | mass      | KGS                    | 1                     |
| litre  | Litre      | volume    | LTR                    | 1                     |
| ml     | Millilitre | volume    | MLT                    | 1                     |
| box    | Box        | count     | BOX                    | 0                     |
| roll   | Roll       | count     | ROL                    | 0                     |
| pair   | Pair       | count     | PRS                    | 0                     |
| bundle | Bundle     | count     | BDL                    | 0                     |

Custom units from 001 (any text up to 20 characters) get a `uom` row with dimension `count` and no UQC.

## Items

### `item_family` (changed)

| Field       | Rule                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| name        | as in 001                                                                                                               |
| kind        | new: `general` (default), `base_paint`, `colorant`, `paint`, `thinner_solvent`                                          |
| category_id | new: nullable FK to `category` ("Uncategorised" when null)                                                              |
| brand_id    | new: nullable FK to `brand`                                                                                             |
| spec        | new: JSON object text, default `{}` (family-level attribute values)                                                     |
| axis_keys   | new: JSON array of 0 to 4 attribute keys from `attribute_def`, in grid order; CHECK `json_array_length(axis_keys) <= 4` |

### `item_variant` (changed)

Existing columns stay. New columns:

| Field                            | Rule                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------- |
| axes                             | JSON object text, default `{}`; keys must equal the family's `axis_keys`         |
| axis_signature                   | text, not null, default `''`; `UNIQUE(family_id, axis_signature)`                |
| purchase_price_paise             | integer, nullable, 0 or more                                                     |
| reorder_level_milli              | integer, nullable, 0 or more                                                     |
| location_tag                     | text up to 30, nullable (for example "Rack B3")                                  |
| petroleum_class                  | `A`, `B`, `C`, `NA`, not null, default `NA`                                      |
| declared_qty_milli, declared_uom | both null or both set; quantity above 0 (CHECK)                                  |
| trade_label                      | text up to 20, nullable                                                          |
| sealed_pack_only                 | 0 or 1, default 0; CHECK `sealed_pack_only = 0 or allow_decimal = 0`             |
| warranty_months                  | integer 0-120, nullable                                                          |
| is_serial_tracked                | 0 or 1, default 0                                                                |
| merged_into_id                   | nullable FK to `item_variant`; set only by a merge; CHECK `merged_into_id <> id` |

Rules checked in `@shopos/core` (`validateVariantDraft`):

- When the family kind is not `general`: `petroleum_class`, `declared_qty_milli` and `declared_uom` are required (FR-009).
- `base_uom` must be a `uom` row; a `sealed_pack_only` variant cannot allow decimals.
- `display_name` is generated by `renderTitle` from the category template, family name and axis values unless the owner typed one.
- The 001 column `barcode` stays, unused (research D7).

**Merge and reversal (D6)**: Move a merged variant's barcode and search-name rows to the survivor only when the survivor has no matching code or case-insensitive name under the table's unique constraint. On collision keep each original row on its original variant, including barcode source and name language/kind. Lookup and search use the survivor's matching row and exclude rows owned by merged variants. If the survivor's matching row is later removed or changed while the merge stands, a code or name then found only on a retained row of a merged variant resolves to that variant's survivor, so the code is never lost and survivor edits are not blocked. **Survivor rule** (`survivorOf(variantId)`, one shared function): follow `merged_into_id` through every merge until a variant that is not merged; lookups, search, tint repeats and colorant stock movements all use it. Example: B merged into A, then A into C: B's retained barcode returns C. While merged, the source variant cannot receive barcode or search-name edits, including via import. Reversal moves back only the IDs logged as moved that are still owned by the survivor; retained rows become visible again with the reactivated source variant. If a moved row was removed or edited on the survivor, restore its original contents from the merge log; if a logged row is still on the survivor, remove that moved row there when restoring it. Unrelated survivor rows stay in place.

### `unit_conversion` (new)

`variant_id` FK, `uom_code` FK, `factor_milli` integer above 0 (thousandths of the base unit in one alternate unit). `UNIQUE(variant_id, uom_code)`; the base unit itself is never listed. Example: wire, base metre, `roll` = 90000.

### `item_barcode` (new)

`variant_id` FK, `code` text 1-48 (digits, letters, hyphen), `source` (`manufacturer`, `shop_label`). Index on `code`, **not unique** (EC-07). `UNIQUE(variant_id, code)`.

### `item_search_name` (new)

`variant_id` FK, `name` text 1-80 trimmed, `language` (`en`, `hi`, `hinglish`), `kind` (`alias`, `trade`, `spelling`). `UNIQUE(variant_id, name)` case-insensitive.

### `price_tier` (new, seeded) and `item_price` (new)

`price_tier`: `code` (`retail`, `contractor`, `dealer`), `label`, `is_default` (Retail only). `item_price`: `variant_id`, `tier_id`, `price_paise` 0 or more, `UNIQUE(variant_id, tier_id)`; never a row for Retail (research D8).

### `item_batch` (new)

`variant_id` FK, `batch_code` text up to 30 (nullable), `mrp_paise` integer above 0, `landed_cost_paise` nullable, `received_at` epoch ms. Index `(variant_id, received_at)` for "oldest batch first" (003). A merge reassigns all of the source variant's batch rows to the survivor, preserving IDs, timestamps and MRP; the survivor's oldest-batch lookup includes them under the usual stock eligibility rules. Reversal restores ownership of the logged batch IDs to the original variant. Historical movement references stay unchanged (D6).

### `item_sales_stat` (new, projection)

One row per variant: `sold_qty_90d_milli`, `bill_count_90d`, `last_sold_at`. Updated in the bill-save and cancel transactions and rebuildable from bill lines (`rebuildItemSalesStats`). Holds nothing that cannot be recomputed.

### `item_merge_log` (new, append-only)
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ac24b0356ddaaa70bdfc83bd22e606b41436763734b820d66604ede9d4619772 -->


| Field                                    | Rule                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| action                                   | `merge` or `reverse`                                                                                                      |
| survivor_id, merged_id                   | FKs to `item_variant`, different                                                                                          |
| merge_log_id                             | for `reverse` rows: the `merge` row reversed; unique (a merge is reversed once)                                           |
| moved_json                               | JSON list of `{ locationId, batchId, qtyMilli }` moved from merged to survivor (signed), one entry per location and batch |
| moved_batch_ids                          | JSON array of batch IDs reassigned to the survivor                                                                        |
| moved_barcode_ids, moved_search_name_ids | JSON arrays of IDs actually moved; log also stores their original row contents for reversal                               |
| reason                                   | text 1-200                                                                                                                |
| user_label                               | text (the user name; roles arrive in 005)                                                                                 |
| reversible_until                         | epoch ms = merged time + 30 days (for `merge` rows)                                                                       |

Triggers reject UPDATE and DELETE. A BEFORE INSERT trigger also rejects a second reversal for the same merge, including via `INSERT OR REPLACE`.


<!-- /coderabbit-ai-generated:v1 -->
### `exception_event` (new)

`kind` (`duplicate_barcode`, `duplicate_suspect`), `subject_type` (`item_variant`), `subject_ids` JSON array, `detail` text up to 200, `status` (`open`, `resolved`), `resolved_at`, `resolution_note`. Status may change from `open` to `resolved` only (trigger). Features 005 and 011 add kinds.

## Lookup tables (research D17)

| Table               | Columns                                                                      | Seeded values                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `movement_type`     | `code`, `direction` (`in`, `out`, `both`), `requires_doc`, `requires_reason` | `opening` in, `adjustment` in or out (direction from the locations, reason required), `sale` out (doc), `sale_cancel` in (doc), `merge_in` in (doc), `merge_out` out (doc) |
| `movement_doc_type` | `code`                                                                       | `bill`, `item_merge`                                                                                                                                                       |
| `tender_mode`       | `code`                                                                       | `cash`, `upi`, `card`, `unpaid`                                                                                                                                            |
| `tender_status`     | `code`                                                                       | `label`                                                                                                                                                                    |
| `exception_kind`    | `code`                                                                       | `duplicate_barcode`, `duplicate_suspect`                                                                                                                                   |

`stock_movement.movement_type` and `doc_type`, `bill_tender.mode` and `status`, and `exception_event.kind` become foreign keys to these. A trigger replaces 001's CHECKs on movements: it reads `movement_type` to require exactly one location for `in` and `out`, both (different) for `both`, a doc for `requires_doc`, and a reason or note for `requires_reason`. Later features add rows, never rebuild.

## Stock (changed)

### `stock_movement`

- Rebuilt **once** (research D17) so `movement_type` and `doc_type` are foreign keys to lookup tables; `merge_in` and `merge_out` are lookup rows; the append-only triggers and the new rule trigger are re-created.
- `doc_type` gains `item_merge` (doc = the `item_merge_log` row); `merge_in` and `merge_out` must carry it.
- New nullable `batch_id` FK to `item_batch`.
- Colorant use on a tinted bill is a normal `sale` movement with doc `bill`.

### `location` (changed)

`kind` gains `tinted_returns`. Seeded row "Tinted returns" per shop (stock is not moved there until feature 003's return flow).

## Tinting

### `tint_shade`

| Field                      | Rule                                                            |
| -------------------------- | --------------------------------------------------------------- |
| shade_code                 | text 1-20; unique per brand among `library` shades              |
| shade_name                 | text 1-60                                                       |
| brand_id                   | FK to `brand`, nullable for custom shades                       |
| shade_card                 | text up to 60, nullable                                         |
| source                     | `library` or `custom`                                           |
| customer_label, site_label | text up to 80, nullable; at least one set for `custom` (FR-016) |
| party_id                   | nullable text, no FK until feature 004 adds `party`             |

### `tint_formula`

`shade_id` FK, `base_variant_id` FK to a `base_paint` variant, `version` integer from 1, `UNIQUE(shade_id, base_variant_id, version)`. The **current** formula is the highest version for its shade and base variant (derived, never a stored flag, so saving version 2 changes no row of version 1). A formula row and its lines are immutable once a bill uses it (trigger checks `bill_line.tint_formula_id`); changes save a new version. The trigger blocks UPDATE/DELETE on used formulas and INSERT/UPDATE/DELETE on lines of used formulas. An UPDATE also cannot move a line into a used formula. Lines can be inserted while creating an unused version.

### `tint_formula_line`

`formula_id` FK, `colorant_variant_id` FK to a `colorant` variant, `qty_milli` integer above 0 (thousandths of a ml; 0.25 ml = 250). `UNIQUE(formula_id, colorant_variant_id)`.

### `tint_charge_rule`

`declared_qty_milli` with `declared_uom` (the pack size, for example 4000 `litre` milli = 4 L), `charge_paise` 0 or more. `UNIQUE(business_id, declared_uom, declared_qty_milli)`.

### `tint_shade_price`

`shade_id`, `base_variant_id`, `price_paise` above 0. When present, it is the line price and no charge is added (FR-015).

## Sales (changed)

### `bill_line` (append-only; new nullable columns)

| Field             | Rule                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------- |
| entered_uom       | text, nullable: the unit the user typed (null = base unit)                               |
| qty_entered_milli | integer, nullable: quantity in the entered unit; `qty_base_milli` stays the stored truth |
| tint_formula_id   | nullable FK to `tint_formula`                                                            |
| tint_charge_paise | integer, nullable, 0 or more; set when the line is tinted                                |
| cost_paise        | integer, nullable: base cost plus colorant cost (research D11)                           |
| is_returnable     | 0 or 1, default 1; 0 for tinted lines                                                    |

### `bill_line_tint` (new, append-only)

`bill_line_id` FK, `colorant_variant_id`, `colorant_name_snapshot`, `qty_milli`, `cost_paise`. One row per colorant of the formula used, written in the bill transaction. `qty_milli` is the colorant for **one base can** (as in the formula); the line's colorant stock movement is `qty_milli` × the line's can count (`qty_base_milli / 1000`). Example: Blue 12.5 ml per can, 2 cans, deducts 25 ml.

## Derived values (in `@shopos/core`)

- `convertToBaseMilli(enteredMilli, factorMilli)` returns the base quantity or `INEXACT_CONVERSION`.
- `buildAxisSignature(axes)`, `generateVariantCombinations(axisValues)` (at most 4 axes), `buildVariantGrid`.
- `rankSearchMatches(query, index, salesStats)`, `normaliseSearchText`, `editDistanceWithin(left, right, limit)`.
- `findLikelyDuplicates(draft, candidates)`.
- `resolveTintFormula(shade, baseVariants, formulas)`, `priceTintedLine({ basePricePaise, chargePaise, shadePricePaise })`, `costTintedLine(...)`.
- `renderTitle(template, values)`, `resolveCategoryDefaults(categoryPath)`.

Example: tinted 4 L "Sky Blue" from base "Pastel 3.6 L" priced ₹1,450.00 plus a 4 L charge of ₹60.00 gives a line of ₹1,510.00. The formula has Blue 12.5 ml and Black 0.75 ml, so stock falls by 1 base can, 12,500 milli of Blue and 750 milli of Black.

## Indexes

- `item_variant(family_id, axis_signature)` unique; `item_variant(merged_into_id)`.
- `item_barcode(code)`; `item_search_name(name COLLATE NOCASE)`.
- `item_batch(variant_id, received_at)`; `stock_movement(batch_id)`.
- `tint_formula(shade_id, base_variant_id, version)` unique (the current version is the maximum); `bill_line(tint_formula_id)`.
- `tint_shade(customer_label COLLATE NOCASE)`, `tint_shade(site_label COLLATE NOCASE)`; `bill(customer_name)` exists from 001.

## State transitions

- Variant: active, inactive (deactivated), merged (inactive with `merged_into_id`); merged goes back to active only by a reversal within 30 days.
- Formula: current, superseded (when a new version is saved). Never deleted.
- Exception event: open, then resolved.
- Shade: library shades are replaced by import (new rows; old shades keep their formulas for old bills).
