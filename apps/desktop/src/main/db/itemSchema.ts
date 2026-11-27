import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { brand, category } from "./catalogueSchema";
import { base } from "./schemaBase";

/**
 * Items as family and variant (001 target shape, extended by spec 002 T017, migration 0017).
 * A 001 item is a "general" family with one variant: no axes and an empty axis signature.
 */
export const itemFamily = sqliteTable(
  "item_family",
  {
    ...base,
    name: text("name").notNull(),
    kind: text("kind").notNull().default("general"),
    categoryId: text("category_id").references(() => category.id),
    brandId: text("brand_id").references(() => brand.id),
    // Family-level attribute values, a JSON object
    spec: text("spec").notNull().default("{}"),
    // 0 to 4 attribute keys in grid order, a JSON array
    axisKeys: text("axis_keys").notNull().default("[]"),
  },
  (tableColumns) => [
    check(
      "item_family_name_len",
      sql`length(${tableColumns.name}) between 1 and 120 and ${tableColumns.name} = trim(${tableColumns.name})`,
    ),
    check(
      "item_family_kind_enum",
      sql`${tableColumns.kind} in ('general', 'base_paint', 'colorant', 'paint', 'thinner_solvent')`,
    ),
    check(
      "item_family_spec_object",
      sql`json_valid(${tableColumns.spec}) and json_type(${tableColumns.spec}) = 'object'`,
    ),
    check(
      "item_family_axis_keys_array",
      sql`json_valid(${tableColumns.axisKeys}) and json_type(${tableColumns.axisKeys}) = 'array' and json_array_length(${tableColumns.axisKeys}) <= 4`,
    ),
  ],
);

/** The 002 variant columns; each is optional or has a default, so 001 rows need no values. */
const variantFields = {
  // JSON object of axis values; keys equal the family's axis_keys (checked in core)
  axes: text("axes").notNull().default("{}"),
  axisSignature: text("axis_signature").notNull().default(""),
  purchasePricePaise: integer("purchase_price_paise"),
  reorderLevelMilli: integer("reorder_level_milli"),
  locationTag: text("location_tag"),
  // A, B, C or NA. No default: NA is an answer the owner gives (spec 002 FR-009, PR #153)
  petroleumClass: text("petroleum_class"),
  declaredQtyMilli: integer("declared_qty_milli"),
  declaredUom: text("declared_uom"),
  tradeLabel: text("trade_label"),
  sealedPackOnly: integer("sealed_pack_only").notNull().default(0),
  warrantyMonths: integer("warranty_months"),
  isSerialTracked: integer("is_serial_tracked").notNull().default(0),
  mergedIntoId: text("merged_into_id"),
};

export const itemVariant = sqliteTable(
  "item_variant",
  {
    ...base,
    familyId: text("family_id")
      .notNull()
      .references(() => itemFamily.id),
    // Short code, unique per business: ITM-0001, ITM-0002, ...
    itemCode: text("item_code").notNull(),
    // display_name: text, not null, 1-120 characters, trimmed
    displayName: text("display_name").notNull(),
    // base_uom: not null, one of pcs/metre/kg/litre/box or a custom name up to 20 characters
    baseUom: text("base_uom").notNull(),
    allowDecimal: integer("allow_decimal").notNull().default(0),
    // selling_price_paise: integer, not null, 0 or more
    sellingPricePaise: integer("selling_price_paise").notNull(),
    // stock_milli: cached sum of movements (may be negative)
    stockMilli: integer("stock_milli").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
    // Reserved, unused in MVP; 002 keeps barcode unused (research D7)
    hsnCode: text("hsn_code"),
    gstRateOverrideBp: integer("gst_rate_override_bp"),
    barcode: text("barcode"),
    ...variantFields,
  },
  (tableColumns) => [
    uniqueIndex("item_variant_code_uq").on(tableColumns.businessId, tableColumns.itemCode),
    uniqueIndex("item_variant_family_signature_uq").on(
      tableColumns.familyId,
      tableColumns.axisSignature,
    ),
    index("item_variant_name_nocase_idx").on(sql`${tableColumns.displayName} COLLATE NOCASE`),
    foreignKey({ columns: [tableColumns.mergedIntoId], foreignColumns: [tableColumns.id] }),
    check(
      "item_variant_name_len",
      sql`length(${tableColumns.displayName}) between 1 and 120 and ${tableColumns.displayName} = trim(${tableColumns.displayName})`,
    ),
    check("item_variant_uom_len", sql`length(${tableColumns.baseUom}) between 1 and 20`),
    check("item_variant_price_nonneg", sql`${tableColumns.sellingPricePaise} >= 0`),
    check("item_variant_allow_decimal_bool", sql`${tableColumns.allowDecimal} in (0, 1)`),
    check("item_variant_active_bool", sql`${tableColumns.isActive} in (0, 1)`),
    ...variantChecks(tableColumns),
  ],
);

type VariantColumns = Record<keyof typeof variantFields | "id" | "allowDecimal", AnySQLiteColumn>;

/** CHECKs for the 002 columns (data-model.md "item_variant (changed)"). */
function variantChecks(tableColumns: VariantColumns) {
  return [...variantAmountChecks(tableColumns), ...variantLabelAndFlagChecks(tableColumns)];
}

/** Amounts and quantities: never negative; a declared pack needs both quantity and unit. */
function variantAmountChecks(tableColumns: VariantColumns) {
  return [
    check(
      "item_variant_purchase_price_nonneg",
      sql`${tableColumns.purchasePricePaise} is null or ${tableColumns.purchasePricePaise} >= 0`,
    ),
    check(
      "item_variant_reorder_level_nonneg",
      sql`${tableColumns.reorderLevelMilli} is null or ${tableColumns.reorderLevelMilli} >= 0`,
    ),
    check(
      "item_variant_declared_pair",
      // Every branch is fully decided: a NULL comparison would make a CHECK pass silently
      sql`(${tableColumns.declaredQtyMilli} is null and ${tableColumns.declaredUom} is null) or (${tableColumns.declaredQtyMilli} is not null and ${tableColumns.declaredQtyMilli} > 0 and ${tableColumns.declaredUom} is not null)`,
    ),
    check(
      "item_variant_warranty_range",
      sql`${tableColumns.warrantyMonths} is null or ${tableColumns.warrantyMonths} between 0 and 120`,
    ),
  ];
}

/** Text lengths, enums and flags, and that a variant is never merged into itself. */
function variantLabelAndFlagChecks(tableColumns: VariantColumns) {
  return [
    check(
      "item_variant_axes_object",
      sql`json_valid(${tableColumns.axes}) and json_type(${tableColumns.axes}) = 'object'`,
    ),
    check(
      "item_variant_location_tag_len",
      sql`${tableColumns.locationTag} is null or length(${tableColumns.locationTag}) <= 30`,
    ),
    check(
      "item_variant_petroleum_class_enum",
      sql`${tableColumns.petroleumClass} is null or ${tableColumns.petroleumClass} in ('A', 'B', 'C', 'NA')`,
    ),
    check(
      "item_variant_trade_label_len",
      sql`${tableColumns.tradeLabel} is null or length(${tableColumns.tradeLabel}) <= 20`,
    ),
    check(
      "item_variant_sealed_pack_whole",
      sql`${tableColumns.sealedPackOnly} in (0, 1) and (${tableColumns.sealedPackOnly} = 0 or ${tableColumns.allowDecimal} = 0)`,
    ),
    check("item_variant_serial_bool", sql`${tableColumns.isSerialTracked} in (0, 1)`),
    check(
      "item_variant_not_merged_into_self",
      sql`${tableColumns.mergedIntoId} is null or ${tableColumns.mergedIntoId} <> ${tableColumns.id}`,
    ),
  ];
}
