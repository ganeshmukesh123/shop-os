import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { uom } from "./catalogueSchema";
import { itemVariant } from "./itemSchema";
import { base } from "./schemaBase";

/**
 * What hangs off a variant (spec 002 T018, migration 0018): alternate units, barcodes, search
 * names, tier prices, batches and the sales projection (data-model.md "Items").
 */
const variantId = () =>
  text("variant_id")
    .notNull()
    .references(() => itemVariant.id);

/** One alternate unit: factor_milli thousandths of the base unit in one of it (roll = 90000). */
export const unitConversion = sqliteTable(
  "unit_conversion",
  {
    ...base,
    variantId: variantId(),
    uomCode: text("uom_code").notNull(),
    factorMilli: integer("factor_milli").notNull(),
  },
  (tableColumns) => [
    uniqueIndex("unit_conversion_variant_uom_uq").on(tableColumns.variantId, tableColumns.uomCode),
    foreignKey({
      columns: [tableColumns.businessId, tableColumns.uomCode],
      foreignColumns: [uom.businessId, uom.code],
    }),
    check("unit_conversion_factor_pos", sql`${tableColumns.factorMilli} > 0`),
  ],
);

/** A code is not unique across variants (EC-07: two items may carry one maker's code). */
export const itemBarcode = sqliteTable(
  "item_barcode",
  {
    ...base,
    variantId: variantId(),
    code: text("code").notNull(),
    source: text("source").notNull(),
  },
  (tableColumns) => [
    index("item_barcode_code_idx").on(tableColumns.code),
    uniqueIndex("item_barcode_variant_code_uq").on(tableColumns.variantId, tableColumns.code),
    check(
      "item_barcode_code_chars",
      sql`length(${tableColumns.code}) between 1 and 48 and ${tableColumns.code} not glob '*[^0-9A-Za-z-]*'`,
    ),
    check(
      "item_barcode_source_enum",
      sql`${tableColumns.source} in ('manufacturer', 'shop_label')`,
    ),
  ],
);

export const itemSearchName = sqliteTable(
  "item_search_name",
  {
    ...base,
    variantId: variantId(),
    name: text("name").notNull(),
    language: text("language").notNull(),
    kind: text("kind").notNull(),
  },
  (tableColumns) => [
    uniqueIndex("item_search_name_variant_name_nocase_uq").on(
      tableColumns.variantId,
      sql`${tableColumns.name} COLLATE NOCASE`,
    ),
    check(
      "item_search_name_len",
      sql`length(${tableColumns.name}) between 1 and 80 and ${tableColumns.name} = trim(${tableColumns.name})`,
    ),
    check(
      "item_search_name_language_enum",
      sql`${tableColumns.language} in ('en', 'hi', 'hinglish')`,
    ),
    check(
      "item_search_name_kind_enum",
      sql`${tableColumns.kind} in ('alias', 'trade', 'spelling')`,
    ),
  ],
);

/** Seeded: retail (the default), contractor, dealer. */
export const priceTier = sqliteTable(
  "price_tier",
  {
    ...base,
    code: text("code").notNull(),
    label: text("label").notNull(),
    isDefault: integer("is_default").notNull().default(0),
  },
  (tableColumns) => [
    uniqueIndex("price_tier_business_code_uq").on(tableColumns.businessId, tableColumns.code),
    check("price_tier_default_bool", sql`${tableColumns.isDefault} in (0, 1)`),
  ],
);

/** A tier price. Retail never has a row: it is the variant's selling price (research D8). */
export const itemPrice = sqliteTable(
  "item_price",
  {
    ...base,
    variantId: variantId(),
    tierId: text("tier_id")
      .notNull()
      .references(() => priceTier.id),
    pricePaise: integer("price_paise").notNull(),
  },
  (tableColumns) => [
    uniqueIndex("item_price_variant_tier_uq").on(tableColumns.variantId, tableColumns.tierId),
    check("item_price_nonneg", sql`${tableColumns.pricePaise} >= 0`),
  ],
);

export const itemBatch = sqliteTable(
  "item_batch",
  {
    ...base,
    variantId: variantId(),
    batchCode: text("batch_code"),
    mrpPaise: integer("mrp_paise").notNull(),
    landedCostPaise: integer("landed_cost_paise"),
    receivedAt: integer("received_at").notNull(),
  },
  (tableColumns) => [
    // Oldest batch first (feature 003)
    index("item_batch_variant_received_idx").on(tableColumns.variantId, tableColumns.receivedAt),
    check("item_batch_mrp_pos", sql`${tableColumns.mrpPaise} > 0`),
    check(
      "item_batch_code_len",
      sql`${tableColumns.batchCode} is null or length(${tableColumns.batchCode}) <= 30`,
    ),
    check(
      "item_batch_landed_cost_nonneg",
      sql`${tableColumns.landedCostPaise} is null or ${tableColumns.landedCostPaise} >= 0`,
    ),
  ],
);

/** A projection, one row per variant, rebuildable from bill lines. Holds nothing original. */
export const itemSalesStat = sqliteTable(
  "item_sales_stat",
  {
    ...base,
    variantId: variantId(),
    soldQty90dMilli: integer("sold_qty_90d_milli").notNull().default(0),
    billCount90d: integer("bill_count_90d").notNull().default(0),
    lastSoldAt: integer("last_sold_at"),
  },
  (tableColumns) => [
    uniqueIndex("item_sales_stat_variant_uq").on(tableColumns.variantId),
    check("item_sales_stat_bill_count_nonneg", sql`${tableColumns.billCount90d} >= 0`),
  ],
);
