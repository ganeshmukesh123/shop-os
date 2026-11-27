import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { itemVariant } from "./itemSchema";
import { movementDocType, movementType } from "./lookupSchema";
import { base } from "./schemaBase";
import { itemBatch } from "./variantDetailSchema";

/**
 * Locations and stock movements. Rebuilt once by spec 002 T019 (migration 0019, research D17):
 * the movement type and document type are lookups, and the rules that depend on the type moved
 * from CHECKs into the stock_movement_rules trigger, which reads movement_type. Moved here from
 * schema.ts with that change.
 */
export const location = sqliteTable(
  "location",
  {
    ...base,
    name: text("name").notNull(),
    // kind: shop_floor, godown or tinted_returns; one "Shop floor" and one "Tinted returns" seeded
    kind: text("kind").notNull(),
  },
  (tableColumns) => [
    check("location_name_len", sql`length(${tableColumns.name}) between 1 and 80`),
    check("location_kind", sql`${tableColumns.kind} in ('shop_floor', 'godown', 'tinted_returns')`),
  ],
);

export const stockMovement = sqliteTable(
  "stock_movement",
  {
    ...base,
    variantId: text("variant_id")
      .notNull()
      .references(() => itemVariant.id),
    // A movement_type code; its row says the direction and whether a doc or reason is needed
    movementType: text("movement_type").notNull(),
    // qty_base_milli: always above 0; the direction comes from the locations
    qtyBaseMilli: integer("qty_base_milli").notNull(),
    fromLocationId: text("from_location_id").references(() => location.id),
    toLocationId: text("to_location_id").references(() => location.id),
    // The document that caused the movement (a movement_doc_type code and its id), else both null
    docType: text("doc_type"),
    docId: text("doc_id"),
    reasonCode: text("reason_code"),
    note: text("note"),
    occurredAt: integer("occurred_at").notNull(),
    deviceId: text("device_id").notNull(),
    batchId: text("batch_id").references(() => itemBatch.id),
  },
  (tableColumns) => [
    index("stock_movement_variant_idx").on(tableColumns.variantId, tableColumns.occurredAt),
    index("stock_movement_doc_idx").on(tableColumns.docType, tableColumns.docId),
    foreignKey({
      columns: [tableColumns.businessId, tableColumns.movementType],
      foreignColumns: [movementType.businessId, movementType.code],
    }),
    foreignKey({
      columns: [tableColumns.businessId, tableColumns.docType],
      foreignColumns: [movementDocType.businessId, movementDocType.code],
    }),
    check("stock_movement_qty_pos", sql`${tableColumns.qtyBaseMilli} > 0`),
    check(
      "stock_movement_doc_pair",
      sql`(${tableColumns.docType} is null) = (${tableColumns.docId} is null)`,
    ),
    check(
      "stock_movement_note_len",
      sql`${tableColumns.note} is null or length(${tableColumns.note}) <= 200`,
    ),
  ],
);
