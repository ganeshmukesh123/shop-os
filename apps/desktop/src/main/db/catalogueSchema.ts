import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { base } from "./schemaBase";

/**
 * Feature 002 catalogue tables (specs/002-items-variants-tinting/data-model.md "Catalogue").
 * Migration 0016 creates them and seeds attribute_def and uom for an existing shop; a new shop
 * gets the same rows from the first-run seed (seed.ts).
 */

/** Units of measure, seeded. `code` is unique per business so other tables can point at it. */
export const uom = sqliteTable(
  "uom",
  {
    ...base,
    code: text("code").notNull(),
    label: text("label").notNull(),
    dimension: text("dimension").notNull(),
    // The GST unit quantity code (UQC); unverified mapping (research OI-1)
    uqc: text("uqc"),
    allowDecimal: integer("allow_decimal").notNull().default(0),
  },
  (tableColumns) => [
    uniqueIndex("uom_business_code_uq").on(tableColumns.businessId, tableColumns.code),
    check("uom_code_len", sql`length(${tableColumns.code}) between 1 and 20`),
    check(
      "uom_dimension_enum",
      sql`${tableColumns.dimension} in ('count', 'length', 'mass', 'volume')`,
    ),
    check("uom_allow_decimal_bool", sql`${tableColumns.allowDecimal} in (0, 1)`),
  ],
);

/** The attributes a variant may vary by (system rows; the shop cannot add its own in 002). */
export const attributeDef = sqliteTable(
  "attribute_def",
  {
    ...base,
    key: text("key").notNull(),
    label: text("label").notNull(),
    dataType: text("data_type").notNull(),
    unitKind: text("unit_kind"),
  },
  (tableColumns) => [
    uniqueIndex("attribute_def_business_key_uq").on(tableColumns.businessId, tableColumns.key),
    check(
      "attribute_def_data_type_enum",
      sql`${tableColumns.dataType} in ('enum', 'text', 'measure')`,
    ),
  ],
);

export const brand = sqliteTable(
  "brand",
  {
    ...base,
    name: text("name").notNull(),
  },
  (tableColumns) => [
    uniqueIndex("brand_business_name_nocase_uq").on(
      tableColumns.businessId,
      sql`${tableColumns.name} COLLATE NOCASE`,
    ),
    check(
      "brand_name_len",
      sql`length(${tableColumns.name}) between 1 and 60 and ${tableColumns.name} = trim(${tableColumns.name})`,
    ),
  ],
);

/** A category tree. Depth (at most 4) is checked in the service, not here. */
export const category = sqliteTable(
  "category",
  {
    ...base,
    parentId: text("parent_id"),
    name: text("name").notNull(),
    defaultHsn: text("default_hsn"),
    defaultBaseUom: text("default_base_uom"),
    titleTemplate: text("title_template"),
  },
  (tableColumns) => [
    foreignKey({ columns: [tableColumns.parentId], foreignColumns: [tableColumns.id] }),
    foreignKey({
      columns: [tableColumns.businessId, tableColumns.defaultBaseUom],
      foreignColumns: [uom.businessId, uom.code],
    }),
    // Siblings: same parent (or both top level) and same name ignoring case
    uniqueIndex("category_sibling_name_nocase_uq").on(
      tableColumns.businessId,
      sql`coalesce(${tableColumns.parentId}, '')`,
      sql`${tableColumns.name} COLLATE NOCASE`,
    ),
    check(
      "category_name_len",
      sql`length(${tableColumns.name}) between 1 and 80 and ${tableColumns.name} = trim(${tableColumns.name})`,
    ),
    check(
      "category_default_hsn_digits",
      sql`${tableColumns.defaultHsn} is null or (length(${tableColumns.defaultHsn}) in (4, 6, 8) and ${tableColumns.defaultHsn} not glob '*[^0-9]*')`,
    ),
  ],
);
