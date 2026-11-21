# Research: Items - Variants, Names and Paint Tinting

**Feature**: `specs/002-items-variants-tinting/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD section 5 (FR-ITM-001 to 017, FR-TNT-001 to 009), PRD sections 12 and 15, the architecture reference sections 6 (catalogue design), 7.2, 7.3, 7.5, 8.1 to 8.4, 10.3 and 11.7, the constitution v2.1.0, and feature 001's design (research D18 put the tables in the architecture's shape so this feature adds columns and tables instead of moving data).

## Decisions

### D1. Catalogue engine: Generic template and a category tree now, packs later

- **Decision**: Build the category tree (3 to 4 levels, with default HSN, base unit and title template per node) and a single **Generic template** whose attributes are the PRD's eight (size, gauge, shade, pack size, colour, length, rating, brand). Seed two additional axes for the feature scenarios: `class` for PVC pipe and `base_type` for base paint. Each family chooses up to 4 of the defined keys as variant axes. Versioned catalogue packs, scoped options, conditional requirements, compliance schemes and QCO rules (architecture 6.2 to 6.10) are not built here.
- **Rationale**: The spec asks for families, up to 4 axes from a fixed set, and a category on the family (FR-001, Key Entities). The architecture says the eight PRD attributes "become the attributes of a Generic fallback template", so building only that template keeps the data in the long-term shape (`category`, `attribute_def`, `category_attribute`) without the pack loader, YAML validator and CI work. Constitution VII: build only what the spec asks for.
- **Alternatives considered**: (a) Full engine with packs now: about 11 extra tables and a CI validator, none required by the spec. (b) Axes as fixed columns (`size`, `colour` ...) on the variant: needs a migration for every new product type, which the architecture rejects (6.4).

### D2. Variant axes as JSON plus a canonical signature

- **Decision**: `item_variant.axes` is a JSON object of axis key to value; `axis_signature` is the canonical text (keys sorted, `key=value` joined by `|`, for example `class=4 kg|size=0.5 in`). `UNIQUE(family_id, axis_signature)`. A one-variant family (all 001 items) has `axes = '{}'` and signature `''`.
- **Generation**: the screen shows the full combination grid as a draft (FR-002); the owner unticks combinations not stocked before saving, so unticked ones are never created. After save a variant is **deactivated, never deleted** (spec edge case "variant on past bills", architecture 8.1 "no deletes").
- **Rationale**: Architecture 6.4 and 6.5; one function in `@shopos/core` (`buildAxisSignature`) means the screen, import and duplicate check agree.
- **Alternative rejected**: deleting saved variants with no history. It saves a few rows but adds a second code path and conflicts with the no-delete rule that sync (feature 010) relies on.

### D3. Unit conversions are exact integers

- **Decision**: A `uom` master lists each unit with a dimension (count, length, mass, volume) and a GST unit code (UQC). `unit_conversion(variant_id, uom_code, factor_milli)` says how many thousandths of the base unit one alternate unit holds (1 roll = 90 m gives `factor_milli = 90000`). Base quantity = entered quantity in thousandths times `factor_milli` / 1000; the result must be a whole number of thousandths or the entry is rejected (`INEXACT_CONVERSION`). Bill lines keep the entered unit and quantity as well as the base quantity.
- **Example**: 2 rolls of 90 m wire: 2000 x 90000 / 1000 = 180000 milli = 180 m deducted. 0.5 box of 10 pcs (decimals off for the box): 500 x 10000 / 1000 = 5000 milli = 5 pcs, accepted because the base result is whole pieces.
- **Rationale**: Constitution III (integers only); the spec scenario "quantities convert exactly".
- **Open item OI-1**: the UQC code for each unit (MTR, NOS, KGS, LTR, MLT, ROL, BOX, PRS, BDL) comes from the architecture's research and is marked "author's inference". Confirm with the CA in feature 008 before the codes reach a GSTR-1 export. Not needed for billing in this feature.

### D4. Search: an in-memory index in the main process, no new package

- **Decision**: The main process builds an in-memory index at start from variant names, family names, search names, item codes and barcodes, and updates it on every write. Text is normalised (Unicode NFC, lower case, Latin diacritics removed, punctuation to spaces; Devanagari kept as typed). Results are ranked in tiers: exact barcode or code, whole-word match, prefix, then fuzzy (Damerau-Levenshtein distance 1 for words of 4 to 7 characters, 2 for 8 or more). Within a tier, items with more sales in the last 90 days rank first (`item_sales_stat`, updated in the bill transaction). Families with more than one variant appear once, as a family row, and Enter opens the grid (D9).
- **Rationale**: Architecture 6.8 ("the index is built in memory at start ... which is how 50,000 items stay within the 0.2 s budget"). The scoring rules are ours (barcode first, then whole word ...), so a pure function in `@shopos/core` (`rankSearchMatches`) can be golden-tested. 001 found `LIKE` with NOCASE took about 4 ms at 5,000 items, but it cannot do typos.
- **Alternatives considered**:

| Option                                 | Typos                                           | Fit               | Why not chosen                                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQLite FTS5 with the trigram tokenizer | Partial (needs 3+ characters, no edit distance) | Built into SQLite | No edit-distance tolerance for "elbo" or "paipa"; ranking by sales needs a join per query                                                                                             |
| Fuse.js or MiniSearch (packages)       | Yes                                             | Good              | A new package needs owner approval (CLAUDE.md); Fuse.js scores by a single fuzzy score, not our tier order; MiniSearch is the fallback if the in-house index misses the budget (OI-2) |
| In-house index (chosen)                | Yes                                             | Exactly our rules | About 200 lines to write and test                                                                                                                                                     |

- **Open item OI-2**: measure the 0.2 s budget with 50,000 generated variants on the owner's Mac (task in Phase 2, with the 016 benchmark harness). If it misses, propose MiniSearch to the owner.
- **Hinglish**: no automatic transliteration. Staff add trade and Hindi names as search names (FR-006); "paipa" works because someone entered it. Transliteration is noted for feature 014.

### D5. Duplicate warning is a pure scoring function

- **Decision**: `findLikelyDuplicates(draft, candidates)` in `@shopos/core` flags an existing variant when (a) brand and category match and the axis signature is equal, or (b) the normalised names are within edit distance 2 or share at least 60% of their character trigrams. The repository supplies candidates by brand and by name prefix, so the check reads at most a few hundred rows. The screen shows matches before saving (FR-008); the owner can still save.
- **Rationale**: FR-ITM-008 names "same brand, similar name, same attributes"; architecture 6.5.

### D6. Merge is a pointer plus stock movements, never an edit of history

- **Decision**: Merging variant B into survivor A:
  1. sets `item_variant.merged_into_id = A` and `is_active = 0` on B (master data, may change);
  2. moves B's noncolliding barcode and search-name rows to A; a duplicate code or case-insensitive name keeps both original rows and their metadata on their original variants. Search and barcode lookup show A via its own row for each collision, and B's retained rows cannot be edited while merged; if A's colliding row is later removed, the retained row resolves to A's final survivor by following `merged_into_id` through each merge (the survivor rule in data-model.md);
  3. inserts, **for each location and batch where B has a non-zero balance**, one `merge_out` from B and one `merge_in` to A for the same quantity, location and batch (negative stock is moved the other way round), so stock per location (007) and MRP per batch are kept;
  4. reassigns B's `item_batch.variant_id` rows to A without changing their IDs, receipt times or MRP. A's oldest-batch lookup includes the reassigned batches, so feature 003 can apply their MRP caps;
  5. inserts an `item_merge_log` row with `action = 'merge'`, who, when, reason, the reassigned batch IDs, the moved barcode and name IDs and original row contents, the moved quantity and `reversible_until` = merged time + 30 days.
     Bill lines and old movements still point at B; reports and the item history follow `merged_into_id`, so "all history moves to the survivor" (FR-ITM-009) without changing a saved bill line (constitution I and II).
- **Reversal** (within 30 days): opposite movements for the quantity moved, ownership of the logged batches restored to B, only the logged moved barcodes and names restored from their original contents to B, pointer cleared, B re-activated, and a second `item_merge_log` row with `action = 'reverse'`. Rows retained on B and unrelated rows on A are untouched; if A was merged again, reverse that later merge first (otherwise reject with `SURVIVOR_MERGED`). Sales of A after the merge stay on A; the reversal screen says so.
- **Alternative rejected**: rewriting `bill_line.variant_id` to the survivor. It breaks the append-only triggers and the 72-month record rule.

### D7. Barcodes in their own table, duplicates allowed and reported

- **Decision**: `item_barcode(variant_id, code, source)` with an index on `code`, **not unique**: EC-07 says a duplicate barcode opens a chooser and logs a data issue, so the database must accept it. The 001 column `item_variant.barcode` (always null so far) is copied into the table by the migration and left unused (dropping a column means rebuilding the table; noted for a later clean-up).
- **Data issues** are rows in `exception_event` (the architecture's name, section 8.2), kinds `duplicate_barcode` and `duplicate_suspect`, status `open` or `resolved`. Features 005 and 011 add more kinds; using their table name now avoids a later move.

### D8. Prices: Retail on the variant, other tiers in `item_price`

- **Decision**: `price_tier` is seeded with Retail (default), Contractor and Dealer. The Retail price stays in `item_variant.selling_price_paise` (001's billing reads it). Other tiers are rows in `item_price(variant_id, tier_id, price_paise)`. `purchase_price_paise` and `reorder_level_milli` are new columns on the variant; `location_tag` is free text such as "Rack B3" (locations as stock places arrive in 007). Applying a tier on a bill is feature 003 (FR-BIL-004); this feature only stores the prices (FR-003).
- **Alternative rejected**: Retail in `item_price` too. It gives one more join on every bill line and a second place that could disagree with the variant column.

### D9. Batches and MRP: stored here, enforced in 003

- **Decision**: `item_batch(variant_id, batch_code, mrp_paise, landed_cost_paise, received_at)`. In this feature a batch is created when opening stock or an adjustment is entered with an MRP; feature 009 creates them from goods receipts. `stock_movement` gains a nullable `batch_id`. The MRP cap at billing and the batch switch (EC-09) are feature 003 FR-005, which lists the same edge case.
- **Rationale**: FR-003 requires "MRP per batch" on the variant; enforcing it belongs to the billing spec that owns the guard.

### D10. Paint, thinner and solvent fields are typed columns

- **Decision**: `item_family.kind` is one of `general`, `base_paint`, `colorant`, `paint`, `thinner_solvent`. For every kind except `general` the variant must carry `petroleum_class` (`A`, `B`, `C`, `NA`), a declared quantity (`declared_qty_milli` with `declared_uom`, the "litres per unit" of FR-009) and `sealed_pack_only`. A sealed pack forces `allow_decimal = 0`. `trade_label` holds the label ("4 L") when it differs from the declared quantity (3.6 L). Checked in `@shopos/core` and by CHECK constraints.
- `warranty_months` (0 to 120, nullable) and `is_serial_tracked` (0 or 1) are variant columns (FR-010); the warranty register is feature 009.
- **Rationale**: Architecture 6.4 and 6.7: fields read on every bill are typed columns, not JSON.

### D11. Tinting model

- **Base paints** are families of kind `base_paint` (brand and product on the family, axes `base_type` x `pack_size`). **Colorants** are families of kind `colorant` with base unit `ml`, decimals on, so 0.25 ml is 250 milli.
- **Shade library**: `tint_shade` (code, name, brand, shade card, `source` `library` or `custom`, and for custom shades a customer label, a site label and a nullable `party_id` that feature 004 connects). `tint_formula` (shade, base variant, version; the current one is the highest version) and `tint_formula_line` (colorant variant, `qty_milli` in thousandths of a ml).
- **Formulas are versioned, not edited**: once a formula has been used on a bill, a change saves a new version; the current formula is the highest version (no flag is updated on the old row, so the immutability trigger never blocks a new version). Each tinted bill line also stores its own snapshot of colorant amounts and costs in `bill_line_tint` (append-only), so a reprint and a repeat order show exactly what was mixed.
- **Billing** (FR-014): pick product, shade and pack size; `resolveTintFormula` picks the base variant and current formula; the screen lists colorant amounts for the tinter. One bill line is the base can; the bill transaction writes a `sale` movement for the base and one `sale` movement per colorant (doc = the bill). Base out of stock is allowed and flagged (spec edge case). No formula: the screen says so and offers a custom shade.
- **Price** (FR-015): the shade price list (`tint_shade_price`, shade and base variant) if loaded, otherwise base price plus `tint_charge_rule` for the pack's declared size (1 L, 4 L, 10 L, 20 L). The line stores `tint_charge_paise`.
- **Cost** (FR-015): `bill_line.cost_paise` = base purchase price + sum of colorant purchase price per ml x ml, rounded half up once. Margin reports are feature 011.
- **Repeat** (FR-016): shades used on earlier bills of the same customer name (case-insensitive) and custom shades with that customer or site label, newest first. For a billed shade, selecting the saved line repeats its snapshot even after the formula is superseded; an unbilled custom shade uses its current formula. When feature 004 adds parties, the lookup uses `party_id`.
- **Returns** (FR-017): a tinted line is saved with `is_returnable = 0`, and a `tinted_returns` location is seeded. The return flow, owner approval and reduced value are features 003 (FR-015 returns) and 005 (approvals); this feature records what they need.
- **Cancel**: 001 cancels by reversing one movement per line. With colorant movements a bill can have more movements than lines, so cancel changes to "reverse every `sale` movement of the bill". Task in Phase 5.

### D12. Spreadsheet import: built here, reused by 012

- **Conflict**: on 2026-11-15 the owner moved spreadsheet import out of 001 into feature 012. Spec 002 still lists item import (FR-011, US4) and shade-library import (FR-013).
- **Proposed resolution (owner to confirm, OD-1)**: this feature builds the item and shade import (preview, validation, duplicate groups, confirm), because its data shape (families, axes, units, paint fields) is defined here. Feature 012 reuses the same preview engine for parties and balances and adds the readiness check. Nothing is built twice.
- **Formats**: CSV in every case. XLSX needs a parser package (OD-2). Tally: item masters exported from Tally to Excel or CSV, then mapped by column. Tally's own XML format is not read.
- **Open item OI-3**: the column layout of a Tally item-master export has not been checked against a real file. Get one from the shop's accountant before writing the column map (Phase 6).

### D13. Labels: content and PDF here, printers in 015

- **Decision**: barcode labels and shelf tags (FR-011, FR-ITM-013) are HTML rendered to PDF with the existing `printToPDF` path, on A4 label sheets (default 65 per sheet, 38.1 x 21.2 mm) and a single-label size for a label printer. The barcode is Code 128 of the item code (`ITM-0042`). Label printer drivers and calibration are feature 015, which also cites FR-ITM-013.
- **Barcode rendering (OD-3)**: a pure Code 128 encoder in `@shopos/core` (a fixed table of 107 patterns plus a checksum, golden-tested against known strings) rendered as SVG bars, or a package (JsBarcode, bwip-js). Recommendation: the in-house encoder, because it is small, has no dependencies and is easy to test; a package needs owner approval anyway.

### D14. Migration of 001's items

Every existing family gets `kind = 'general'`, no category (shown as "Uncategorised"), no brand; every variant keeps `axes = '{}'`, signature `''` and all its ids. No stock movement, bill or line is touched. Migrations start at `0013`.

### D15. Variant grid

`buildVariantGrid(family, variants, stockByVariant)` in `@shopos/core` puts axis 1 on rows and axis 2 on columns, with each cell holding stock and price. With 3 or 4 axes, the remaining axes become tabs above the grid. With 1 axis the grid is a single column. Arrow keys move, Enter adds the cell to the bill (spec US1 scenario 2).

### D16. Cross-feature calendar (proposed 2026-11-18)

This table is the **single source** for dates: when a window moves, update it here and in that feature's milestone table only. Features are planned in number order but cannot be **built** in number order: 003 needs 004 and 005, and 004 needs 005. Proposed build order and windows for one full-time builder (re-date when each feature starts):

| Order | Feature                                            | Window                        | Weeks |
| ----- | -------------------------------------------------- | ----------------------------- | ----- |
| now   | 018 Electron hardening (P1 stories)                | 18 Nov to 20 Dec 2026         | 5     |
| 1     | 016 quality routine (benchmarks, offline test kit) | 21 Dec 2026 to 3 Jan 2027     | 2     |
| 2     | **002 items, variants, tinting**                   | 4 Jan to 21 Feb 2027          | 7     |
| 3     | 005 roles, approvals, audit, day-close             | 22 Feb to 21 Mar 2027         | 4     |
| 4     | 004 parties and khata                              | 22 Mar to 25 Apr 2027         | 5     |
| 5     | 003 advanced billing                               | 26 Apr to 6 Jun 2027          | 6     |
| 6     | 008 GST and compliance                             | 7 Jun to 4 Jul 2027           | 4     |
| 7     | 007 stock by location and rolls                    | 5 Jul to 1 Aug 2027           | 4     |
| 8     | 006 delivery                                       | 2 Aug to 22 Aug 2027          | 3     |
| 9     | 012 go-live tools                                  | 23 Aug to 12 Sep 2027         | 3     |
| 10    | 015 devices, printing, scanning                    | 13 Sep to 3 Oct 2027          | 3     |
| 11    | 009 purchases and warranty                         | 4 Oct to 7 Nov 2027           | 5     |
| 12    | 010 owner app, sync, cloud backup                  | 8 Nov 2027 to 16 Jan 2028     | 10    |
| 13    | 011 reports and CA export                          | 17 Jan to 13 Feb 2028         | 4     |
| 14    | 014 languages                                      | 14 Feb to 5 Mar 2028          | 3     |
| 15    | 013 pilot and plans                                | from 6 Mar 2028, after Gate 3 | 4     |

001's remaining milestones (M3b, M5, the M6 trial in March 2027) run alongside 002 and 005.

**Risk (owner decision OD-4)**: with every MVP feature in full, go-live lands around 1 October 2027, four months after the PRD's 1 June 2027. Options: (a) accept the later date; (b) start a limited 1 June 2027 go-live with completed features 002, 005 and 004 and the 001 no-tax billing scope, where that scope is suitable; roll out 003 after its 6 June finish and 008 after its 4 July finish, with 007, 006 and 012 following the calendar; (c) work part of 007 and 006 in parallel. Recommendation: (b), if the shop can start within that limited scope; advanced billing and both bill formats remain later rollout gates.

### D17. Enum values live in lookup tables, so later features add values without rebuilding tables (staff review 2026-11-18)

- **Problem**: 001's enums are text columns with a CHECK. SQLite can change a CHECK only by rebuilding the table (https://www.sqlite.org/lang_altertable.html#otheralter). The plans for 002, 003, 007 and 009 each rebuilt `stock_movement`, and 003, 004, 006, 009 and 011 widened other enums the same way. 006, 007 and 009 run after go-live, on real data, and 012 D10 needs additive migrations for rollback.
- **Decision**: one rebuild of `stock_movement` and `bill_tender`, in this feature, turns their enum columns into foreign keys to small lookup tables. From then on, adding a value is an INSERT into the lookup table (additive, rollback-safe).
  - `movement_type(code, direction, requires_doc, requires_reason)`: `direction` is `in`, `out` or `both` (transfer); `requires_doc` and `requires_reason` replace 001's CHECKs (a sale needs its bill; an adjustment needs a reason). A trigger on `stock_movement` reads the row to enforce the locations, doc and reason rules, so 007's transfer needs only a new row.
  - `movement_doc_type(code)`, `tender_mode(code)`, `tender_status(code)`.
  - Rule for later features: every new enum is a lookup table from the start (`ledger_entry_type` with a `sign` column in 004, `cash_entry_kind` in 005, `doc_kind` in 003, `exception_kind` here); adding a value is an INSERT.
- **Trade-off**: one join to read a label; triggers instead of CHECKs for the rules that depend on the type. Rejected: keep CHECKs and rebuild each time (four rebuilds of the largest append-only table, two after go-live).
- **Practice**: SQLite's documentation gives the 12-step rebuild as the only way to change a constraint (primary). Stripe adds enum values to its API without breaking existing data (https://stripe.com/docs/upgrades, primary vendor documentation). No named company source for SQLite lookup tables specifically.

## Open items (unverified facts, constitution "Unconfirmed facts")

| ID   | Item                                                                                                  | Resolve by                                           | Milestone          |
| ---- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------ |
| OI-1 | UQC codes per unit                                                                                    | Shop's CA                                            | Before 008 exports |
| OI-2 | 0.2 s search at 50,000 variants with the in-house index                                               | Benchmark on the owner's Mac                         | 002 M1             |
| OI-3 | Tally item-master export columns                                                                      | A real export from the shop's accountant             | 002 M5             |
| OI-4 | Legal Metrology view of tinting inside a sealed base can (spec assumption)                            | Brand representative or local Legal Metrology office | Before go-live     |
| OI-5 | Brand shade cards: format of the formula file the owner can get (Excel columns, units: ml or "shots") | Owner, from the brand's dealer portal                | 002 M4             |
| OI-6 | Label sheet size the shop buys (65-up or other)                                                       | Owner                                                | 002 M5             |

## Owner decisions needed (before the named milestone)

| ID   | Question                                                             | Recommendation                                                                                                             | Needed by         |
| ---- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| OD-1 | Item and shade import in 002 (reused by 012), not only in 012?       | Yes, D12                                                                                                                   | 002 M5            |
| OD-2 | XLSX parser package: SheetJS Community Edition, exceljs, or CSV only | SheetJS CE pinned from its own distribution (read-only parsing, no runtime dependencies); CSV only if no package is wanted | 002 M5            |
| OD-3 | Code 128: in-house encoder or a package                              | In-house, D13                                                                                                              | 002 M5            |
| OD-4 | Go-live scope and date                                               | Option (b) in D16                                                                                                          | Before 005 starts |

## References

- Architecture reference, sections 6, 7.3, 7.5, 8.4, 10.3, 11.7 (`docs/reference/architecture.md`).
- SQLite FTS5 trigram tokenizer: https://www.sqlite.org/fts5.html#the_trigram_tokenizer (primary).
- Damerau-Levenshtein distance: F. J. Damerau, "A technique for computer detection and correction of spelling errors", Communications of the ACM 7(3), 1964 (primary).
- Code 128 symbology: ISO/IEC 15417:2007 (primary standard).
- GS1 General Specifications (in-store and restricted-circulation numbers): https://www.gs1.org/standards/barcodes-epcrfid-id-keys/gs1-general-specifications (primary).
- Legal Metrology (Packaged Commodities) Rules 2011 and the 2022 amendment removing standard pack sizes: https://consumeraffairs.nic.in/ (primary; the tinting question OI-4 is not answered there).
- Industry practice: Shopify's product model uses one product with up to 3 options and variants for each combination (https://shopify.dev/docs/api/admin-graphql/latest/objects/ProductVariant, primary vendor documentation). Square's catalogue uses an item with item variations and an "item option" set (https://developer.squareup.com/docs/catalog-api/item-options, primary vendor documentation). Both match the family-and-variant shape; neither documents a 4-axis limit, which comes from the PRD.
