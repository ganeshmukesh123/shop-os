# Contract: commands added or changed by feature 002

Same rules as `specs/001-shop-os-mvp/contracts/ipc-commands.md`: every command returns `{ ok: true, data }` or `{ ok: false, code, message }`; money is integer paise, quantity is integer thousandths; inputs are validated by the same Zod schemas in `@shopos/core` on both sides; the renderer never touches the database.

## Catalogue and families

| Command                                           | Input                                                                                                                                                                               | Result                                                                                      | Error codes                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `catalogue.categories.list`                       | `{}`                                                                                                                                                                                | `{ categories[] }` (tree, with resolved defaults)                                           |                                                                                     |
| `catalogue.categories.save`                       | `{ id?, parentId?, name, defaultHsn?, defaultBaseUom?, titleTemplate? }`                                                                                                            | `{ category }`                                                                              | `DUPLICATE_NAME`, `TOO_DEEP`, `INVALID_FIELD`                                       |
| `catalogue.brands.list` / `catalogue.brands.save` | `{}` / `{ id?, name }`                                                                                                                                                              | `{ brands[] }` / `{ brand }`                                                                | `DUPLICATE_NAME`                                                                    |
| `catalogue.units.list`                            | `{}`                                                                                                                                                                                | `{ units[] }`                                                                               |                                                                                     |
| `families.previewVariants`                        | `{ axisKeys[], axisValues: { key: values[] } }`                                                                                                                                     | `{ combinations[{ axes, axisSignature, displayName }] }`                                    | `TOO_MANY_AXES` (more than 4, says why), `UNKNOWN_ATTRIBUTE`                        |
| `families.create`                                 | `{ family: { name, kind, categoryId?, brandId?, spec, axisKeys }, variants[{ axes, displayName?, baseUom, allowDecimal, sellingPricePaise, openingQtyMilli, ...variant fields }] }` | `{ family, variants[], duplicates[] }`                                                      | `DUPLICATE_NAME`, `DUPLICATE_SIGNATURE`, `MISSING_PAINT_FIELDS`, `INVALID_QUANTITY` |
| `families.get`                                    | `{ id }`                                                                                                                                                                            | `{ family, variants[], conversions[], barcodes[], searchNames[], prices[] }`                | `NOT_FOUND`                                                                         |
| `families.update`                                 | `{ id, name?, categoryId?, brandId?, spec? }`                                                                                                                                       | `{ family }`                                                                                | `NOT_FOUND`                                                                         |
| `families.addVariants`                            | `{ familyId, variants[] }`                                                                                                                                                          | `{ variants[] }`                                                                            | `DUPLICATE_SIGNATURE`                                                               |
| `variants.update`                                 | `{ id, ...variant fields except axes }`                                                                                                                                             | `{ variant }`                                                                               | `MISSING_PAINT_FIELDS`, `SEALED_PACK_DECIMAL`                                       |
| `variants.setActive`                              | `{ id, isActive }`                                                                                                                                                                  | `{ variant }`                                                                               | `MERGED`                                                                            |
| `variants.setConversions`                         | `{ variantId, conversions[{ uomCode, factorMilli }] }`                                                                                                                              | `{ conversions[] }`                                                                         | `INVALID_FACTOR`, `BASE_UNIT_LISTED`                                                |
| `variants.setBarcodes`                            | `{ variantId, barcodes[{ code, source }] }`                                                                                                                                         | `{ barcodes[], sharedWith[] }` (other variants using the same code; a data issue is logged) | `INVALID_BARCODE`                                                                   |
| `variants.setSearchNames`                         | `{ variantIds[], names[{ name, language, kind }] }`                                                                                                                                 | `{ searchNames[] }`                                                                         | `INVALID_FIELD`                                                                     |
| `variants.setPrices`                              | `{ variantId, prices[{ tierCode, pricePaise }] }`                                                                                                                                   | `{ prices[] }`                                                                              | `UNKNOWN_TIER`                                                                      |
| `variants.addBatch`                               | `{ variantId, batchCode?, mrpPaise, landedCostPaise? }`                                                                                                                             | `{ batch }`                                                                                 | `INVALID_FIELD`                                                                     |

`items.create` and `items.update` from 001 stay and act on a one-variant family.

## Search, duplicates, merge, data issues

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:b66923a147f8981d2c37c7d2530ebc0e7cc3949bd5d84cdbf1305b7039f2dce3 -->

| Command                                  | Input                                                       | Result                                                                                                           | Error codes                                                                           |
| ---------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `items.search`                           | `{ query, limit }`                                          | `{ results[{ kind: "variant" or "family", id, displayName, matchedBy, stockMilli, pricePaise }] }` in rank order |                                                                                       |
| `items.lookupBarcode`                    | `{ code }`                                                  | `{ variants[] }` (two or more opens the chooser; a data issue is logged once per code)                           |                                                                                       |
| `families.grid`                          | `{ familyId }`                                              | `{ rowAxis, columnAxis, tabAxes[], cells[{ variantId, stockMilli, pricePaise, isActive }] }`                     | `NOT_FOUND`                                                                           |
| `items.checkDuplicates`                  | `{ draft: { name, brandId?, categoryId?, axisSignature } }` | `{ candidates[{ variantId, displayName, reason }] }`                                                             |                                                                                       |
| `items.merge`                            | `{ survivorId, mergedId, reason }`                          | `{ mergeLog, survivor }`                                                                                         | `SAME_ITEM`, `ALREADY_MERGED`, `UNIT_MISMATCH` (base units differ), `REASON_REQUIRED` |
| `items.merge.reverse`                    | `{ mergeLogId, reason }`                                    | `{ reverseLog }`                                                                                                 | `REVERSAL_WINDOW_CLOSED`, `ALREADY_REVERSED`, `SURVIVOR_MERGED`                                          |
| `items.merge.list`                       | `{ limit, offset }`                                         | `{ merges[], total }`                                                                                            |                                                                                       |
| `exceptions.list` / `exceptions.resolve` | `{ status?, kind? }` / `{ id, note }`                       | `{ events[] }` / `{ event }`                                                                                     | `NOT_FOUND`                                                                           |

<!-- /coderabbit-ai-generated:v1 -->

## Tinting

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:22a3936469c431bd8f18d6e8710c0cd79088cd1d1050410d0dde3f3910fc30fd -->

| Command                                   | Input                                                                                              | Result                                                                                                                       | Error codes                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `tint.shades.search`                      | `{ query, brandId? }`                                                                              | `{ shades[] }`                                                                                                               |                                                        |
| `tint.resolve`                            | `{ productFamilyId, shadeId, packVariantId }`                                                      | `{ baseVariant, formula, lines[{ colorantVariantId, name, qtyMilli, stockMilli }], unitPricePaise, chargePaise, costPaise }` | `NO_FORMULA` (offer a custom shade), `NOT_A_BASE`      |
| `tint.customShade.save`                   | `{ shadeName, customerLabel?, siteLabel?, baseVariantId, lines[{ colorantVariantId, qtyMilli }] }` | `{ shade, formula }`                                                                                                         | `LABEL_REQUIRED`, `NOT_A_COLORANT`, `INVALID_QUANTITY` |
| `tint.formula.saveVersion`                | `{ shadeId, baseVariantId, lines[] }`                                                              | `{ formula }` (new version, previous one superseded)                                                                         | `NOT_FOUND`                                            |
| `tint.repeat.list`                        | `{ customerName?, siteLabel? }`                                                                    | `{ shades[{ shade, formula, lastBilledAt, baseVariant, sourceBillLineId?, lines[{ colorantVariantId, qtyMilli }] }] }` newest first                                                     |                                                        |
| `tint.charges.list` / `tint.charges.save` | `{}` / `{ rules[{ declaredQtyMilli, declaredUom, chargePaise }] }`                                 | `{ rules[] }`                                                                                                                | `INVALID_FIELD`                                        |

A billed repeat entry includes `sourceBillLineId` and displays the saved colorant amounts. An unbilled custom shade has no source line and uses the ordinary current-formula path.

<!-- /coderabbit-ai-generated:v1 -->

## Bills (changed)

`bills.save` line input gains optional fields:

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:90207635e630a6ba8e5d19866206848bb0f96d41fa7fdbefb41aecf64ad31c51 -->

```ts
interface IBillLineInput {
  itemId: string; // the variant id (001 name kept)
  quantityMilli: number; // in the entered unit
  enteredUom?: string; // absent = base unit
  ratePaise: number;
  lineDiscountPaise: number;
  tint?: { formulaId: string; sourceBillLineId?: never } | { sourceBillLineId: string; formulaId?: never };
}
```

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:4f6b2e353656d09a6d8d42836ac3f6476c2a06b7aec0bd21d5d04855c6e8a6e1 -->

New error codes: `INEXACT_CONVERSION` (the entered quantity does not convert to whole thousandths), `UNKNOWN_UNIT` (no conversion for that unit).

- For an ordinary sale, the server loads `formulaId` and requires the current version for its shade and base variant (`FORMULA_NOT_CURRENT` otherwise).
- For a repeat, the server loads the referenced tinted bill line and its immutable `bill_line_tint` snapshot within the current shop. A missing, out-of-shop or non-tinted source gives `INVALID_TINT_REPEAT_SOURCE`. Use the source line's `tint_formula_id` and saved colorant quantities for the new line and stock movements, even if the formula is superseded. The new sale uses the normal tint pricing rules.
- Both paths require the formula's `base_variant_id` to equal `itemId`; the repeat source line must also have that variant. Reject a mismatch with `FORMULA_BASE_MISMATCH` before any bill or stock writes.

The guarantees of 001 hold: one transaction (bill, lines, `bill_line_tint` rows, every stock movement including colorants, the sales statistic), idempotent by `clientBillId`, and no rejection for insufficient stock (`negativeStockItems` lists bases and colorants that went below zero).

<!-- /coderabbit-ai-generated:v1 -->

`bills.cancel` reverses every `sale` movement of the bill, not one per line.

## Import and labels

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:c4dc091b9455b20a350632f4f09393ff4beab7ba6e0dd23307bccc649d012e63 -->

| Command                                          | Input                                                                                   | Result                                                                                                       | Error codes                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `import.items.preview`                           | `{ filePath, mapping? }`                                                                | `{ previewId, rowsOk, errors[{ row, column, message }], duplicateGroups[], missingUnits[] }` (nothing saved) | `UNREADABLE_FILE`, `UNSUPPORTED_FORMAT` |
| `import.items.commit`                            | `{ previewId }`                                                                         | `{ familiesCreated, variantsCreated }`                                                                       | `PREVIEW_EXPIRED`, `PREVIEW_HAS_ERRORS` |
| `import.shades.preview` / `import.shades.commit` | as above                                                                                | `{ previewId, shadesOk, formulasOk, errors[] }` / `{ shadesCreated, formulasCreated }`                                  | as above                                |
| `labels.exportPdf`                               | `{ variantIds[], layout: "sheet65" or "single", kind: "barcode" or "shelf", filePath }` | `{ filePath }`                                                                                               | `WRITE_FAILED`, `NO_ITEMS`              |
| `labels.print`                                   | `{ variantIds[], layout, kind }`                                                        | `{ printed }`                                                                                                | `PRINT_FAILED`                          |

<!-- /coderabbit-ai-generated:v1 -->
