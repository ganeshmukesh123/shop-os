import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { base } from "./schemaBase";

/** Items as family and variant (001 target shape). Moved here from schema.ts unchanged. */
export const itemFamily = sqliteTable(
  "item_family",
  {
    ...base,
    // One family per item for now; feature 002 adds category, brand and specification.
    name: text("name").notNull(),
  },
  (tableColumns) => [
    check(
      "item_family_name_len",
      sql`length(${tableColumns.name}) between 1 and 120 and ${tableColumns.name} = trim(${tableColumns.name})`,
    ),
  ],
);

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
    // Reserved, unused in MVP
    hsnCode: text("hsn_code"),
    gstRateOverrideBp: integer("gst_rate_override_bp"),
    barcode: text("barcode"),
  },
  (tableColumns) => [
    uniqueIndex("item_variant_code_uq").on(tableColumns.businessId, tableColumns.itemCode),
    index("item_variant_name_nocase_idx").on(sql`${tableColumns.displayName} COLLATE NOCASE`),
    check(
      "item_variant_name_len",
      sql`length(${tableColumns.displayName}) between 1 and 120 and ${tableColumns.displayName} = trim(${tableColumns.displayName})`,
    ),
    check("item_variant_uom_len", sql`length(${tableColumns.baseUom}) between 1 and 20`),
    check("item_variant_price_nonneg", sql`${tableColumns.sellingPricePaise} >= 0`),
    check("item_variant_allow_decimal_bool", sql`${tableColumns.allowDecimal} in (0, 1)`),
    check("item_variant_active_bool", sql`${tableColumns.isActive} in (0, 1)`),
  ],
);
