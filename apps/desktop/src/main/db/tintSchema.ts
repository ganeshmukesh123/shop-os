import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { brand } from "./catalogueSchema";
import { itemVariant } from "./itemSchema";
import { billLine } from "./schema";
import { base } from "./schemaBase";

/**
 * Paint tinting (spec 002 T020, migration 0021; data-model.md "Tinting"). A formula used on a
 * bill is frozen by triggers in 0021; a change saves a new version, and the current formula is
 * the highest version (never a stored flag).
 */
export const tintShade = sqliteTable(
  "tint_shade",
  {
    ...base,
    shadeCode: text("shade_code").notNull(),
    shadeName: text("shade_name").notNull(),
    brandId: text("brand_id").references(() => brand.id),
    shadeCard: text("shade_card"),
    source: text("source").notNull(),
    customerLabel: text("customer_label"),
    siteLabel: text("site_label"),
    // No FK until feature 004 adds party
    partyId: text("party_id"),
  },
  (tableColumns) => [
    uniqueIndex("tint_shade_library_code_uq")
      .on(tableColumns.brandId, tableColumns.shadeCode)
      .where(sql`${tableColumns.source} = 'library'`),
    check("tint_shade_code_len", sql`length(${tableColumns.shadeCode}) between 1 and 20`),
    check("tint_shade_name_len", sql`length(${tableColumns.shadeName}) between 1 and 60`),
    check(
      "tint_shade_card_len",
      sql`${tableColumns.shadeCard} is null or length(${tableColumns.shadeCard}) <= 60`,
    ),
    check("tint_shade_source_enum", sql`${tableColumns.source} in ('library', 'custom')`),
    check(
      "tint_shade_labels_len",
      sql`(${tableColumns.customerLabel} is null or length(${tableColumns.customerLabel}) <= 80) and (${tableColumns.siteLabel} is null or length(${tableColumns.siteLabel}) <= 80)`,
    ),
    // FR-016: a custom shade says whose or which site it is
    check(
      "tint_shade_custom_labelled",
      sql`${tableColumns.source} = 'library' or coalesce(trim(${tableColumns.customerLabel}, char(9, 10, 11, 12, 13, 32)), '') <> '' or coalesce(trim(${tableColumns.siteLabel}, char(9, 10, 11, 12, 13, 32)), '') <> ''`,
    ),
  ],
);

export const tintFormula = sqliteTable(
  "tint_formula",
  {
    ...base,
    shadeId: text("shade_id")
      .notNull()
      .references(() => tintShade.id),
    baseVariantId: text("base_variant_id")
      .notNull()
      .references(() => itemVariant.id),
    version: integer("version").notNull(),
  },
  (tableColumns) => [
    uniqueIndex("tint_formula_version_uq").on(
      tableColumns.shadeId,
      tableColumns.baseVariantId,
      tableColumns.version,
    ),
    check("tint_formula_version_pos", sql`${tableColumns.version} >= 1`),
  ],
);

/** Colorant for one base can, in thousandths of a ml (0.25 ml = 250). */
export const tintFormulaLine = sqliteTable(
  "tint_formula_line",
  {
    ...base,
    formulaId: text("formula_id")
      .notNull()
      .references(() => tintFormula.id),
    colorantVariantId: text("colorant_variant_id")
      .notNull()
      .references(() => itemVariant.id),
    qtyMilli: integer("qty_milli").notNull(),
  },
  (tableColumns) => [
    uniqueIndex("tint_formula_line_colorant_uq").on(
      tableColumns.formulaId,
      tableColumns.colorantVariantId,
    ),
    check("tint_formula_line_qty_pos", sql`${tableColumns.qtyMilli} > 0`),
  ],
);

/** The tinting charge for a pack size (4000 litre-milli = 4 L). */
export const tintChargeRule = sqliteTable(
  "tint_charge_rule",
  {
    ...base,
    declaredQtyMilli: integer("declared_qty_milli").notNull(),
    declaredUom: text("declared_uom").notNull(),
    chargePaise: integer("charge_paise").notNull(),
  },
  (tableColumns) => [
    uniqueIndex("tint_charge_rule_pack_uq").on(
      tableColumns.businessId,
      tableColumns.declaredUom,
      tableColumns.declaredQtyMilli,
    ),
    check("tint_charge_rule_qty_pos", sql`${tableColumns.declaredQtyMilli} > 0`),
    check("tint_charge_rule_charge_nonneg", sql`${tableColumns.chargePaise} >= 0`),
  ],
);

/** When present, the whole line price for a shade on a base can; no charge is added (FR-015). */
export const tintShadePrice = sqliteTable(
  "tint_shade_price",
  {
    ...base,
    shadeId: text("shade_id")
      .notNull()
      .references(() => tintShade.id),
    baseVariantId: text("base_variant_id")
      .notNull()
      .references(() => itemVariant.id),
    pricePaise: integer("price_paise").notNull(),
  },
  (tableColumns) => [
    uniqueIndex("tint_shade_price_uq").on(tableColumns.shadeId, tableColumns.baseVariantId),
    check("tint_shade_price_pos", sql`${tableColumns.pricePaise} > 0`),
  ],
);

/** One row per colorant of the formula a tinted line used, for one base can. Append-only. */
export const billLineTint = sqliteTable(
  "bill_line_tint",
  {
    ...base,
    // bill_line is defined in schema.ts; the reference is read lazily, so the import cycle is safe
    billLineId: text("bill_line_id")
      .notNull()
      .references(() => billLine.id),
    colorantVariantId: text("colorant_variant_id")
      .notNull()
      .references(() => itemVariant.id),
    colorantNameSnapshot: text("colorant_name_snapshot").notNull(),
    qtyMilli: integer("qty_milli").notNull(),
    costPaise: integer("cost_paise").notNull(),
  },
  (tableColumns) => [
    uniqueIndex("bill_line_tint_colorant_uq").on(
      tableColumns.billLineId,
      tableColumns.colorantVariantId,
    ),
    check("bill_line_tint_qty_pos", sql`${tableColumns.qtyMilli} > 0`),
    check("bill_line_tint_cost_nonneg", sql`${tableColumns.costPaise} >= 0`),
  ],
);
