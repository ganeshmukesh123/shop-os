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
 * Lookup tables (spec 002 T019, research D17, migration 0019). Enum values live here, so a later
 * feature adds a value with an INSERT instead of rebuilding stock_movement or bill_tender.
 * Each is keyed by (business_id, code), like uom, and seeded per shop.
 */
const codeTable = (tableName: string) =>
  sqliteTable(tableName, { ...base, code: text("code").notNull() }, (tableColumns) => [
    uniqueIndex(`${tableName}_business_code_uq`).on(tableColumns.businessId, tableColumns.code),
    check(`${tableName}_code_len`, sql`length(${tableColumns.code}) between 1 and 40`),
  ]);

export const movementDocType = codeTable("movement_doc_type");
export const tenderMode = codeTable("tender_mode");
export const tenderStatus = codeTable("tender_status");
export const exceptionKind = codeTable("exception_kind");

/**
 * How a movement type moves stock. `direction`: `in` (to a location), `out` (from one), `either`
 * (exactly one side: an adjustment) or `both` (from one location to another: a transfer).
 * The stock_movement_rules trigger reads this row on every insert.
 */
export const movementType = sqliteTable(
  "movement_type",
  {
    ...base,
    code: text("code").notNull(),
    direction: text("direction").notNull(),
    requiresDoc: integer("requires_doc").notNull().default(0),
    // The document type the movement must carry when requires_doc is 1 (bill, item_merge)
    requiredDocType: text("required_doc_type"),
    requiresReason: integer("requires_reason").notNull().default(0),
  },
  (tableColumns) => [
    uniqueIndex("movement_type_business_code_uq").on(tableColumns.businessId, tableColumns.code),
    foreignKey({
      columns: [tableColumns.businessId, tableColumns.requiredDocType],
      foreignColumns: [movementDocType.businessId, movementDocType.code],
    }),
    check("movement_type_code_len", sql`length(${tableColumns.code}) between 1 and 40`),
    check(
      "movement_type_direction_enum",
      sql`${tableColumns.direction} in ('in', 'out', 'either', 'both')`,
    ),
    check(
      "movement_type_doc_rule",
      sql`(${tableColumns.requiresDoc} = 0 and ${tableColumns.requiredDocType} is null) or (${tableColumns.requiresDoc} = 1 and ${tableColumns.requiredDocType} is not null)`,
    ),
    check("movement_type_reason_bool", sql`${tableColumns.requiresReason} in (0, 1)`),
  ],
);
