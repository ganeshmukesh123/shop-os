import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { itemVariant } from "./itemSchema";
import { base } from "./schemaBase";

/** Locations and stock movements. Moved here from schema.ts unchanged. */
export const location = sqliteTable(
  "location",
  {
    ...base,
    name: text("name").notNull(),
    // kind: shop_floor or godown; this release has one seeded "Shop floor", feature 007 adds more
    kind: text("kind").notNull(),
  },
  (tableColumns) => [
    check("location_name_len", sql`length(${tableColumns.name}) between 1 and 80`),
    check("location_kind", sql`${tableColumns.kind} in ('shop_floor','godown')`),
  ],
);

export const stockMovement = sqliteTable(
  "stock_movement",
  {
    ...base,
    variantId: text("variant_id")
      .notNull()
      .references(() => itemVariant.id),
    // movement_type: one of opening, adjustment, sale, sale_cancel
    movementType: text("movement_type").notNull(),
    // qty_base_milli: always above 0; the direction comes from the locations
    qtyBaseMilli: integer("qty_base_milli").notNull(),
    // Stock in has only to_location_id, stock out has only from_location_id
    fromLocationId: text("from_location_id").references(() => location.id),
    toLocationId: text("to_location_id").references(() => location.id),
    // The document that caused the movement: doc_type 'bill' and the bill's id, else both null
    docType: text("doc_type"),
    docId: text("doc_id"),
    reasonCode: text("reason_code"),
    note: text("note"),
    occurredAt: integer("occurred_at").notNull(),
    deviceId: text("device_id").notNull(),
  },
  (tableColumns) => [
    index("stock_movement_variant_idx").on(tableColumns.variantId, tableColumns.occurredAt),
    index("stock_movement_doc_idx").on(tableColumns.docType, tableColumns.docId),
    check("stock_movement_qty_pos", sql`${tableColumns.qtyBaseMilli} > 0`),
    check(
      "stock_movement_type",
      sql`${tableColumns.movementType} in ('opening','adjustment','sale','sale_cancel')`,
    ),
    check(
      "stock_movement_one_direction",
      sql`(${tableColumns.fromLocationId} is null) <> (${tableColumns.toLocationId} is null)`,
    ),
    check(
      "stock_movement_doc_pair",
      sql`(${tableColumns.docType} is null) = (${tableColumns.docId} is null) and (${tableColumns.docType} is null or ${tableColumns.docType} = 'bill') and (${tableColumns.docId} is not null) = (${tableColumns.movementType} in ('sale','sale_cancel'))`,
    ),
    check(
      "stock_movement_adjustment_note",
      sql`${tableColumns.movementType} <> 'adjustment' or (${tableColumns.note} is not null and length(trim(${tableColumns.note})) > 0)`,
    ),
    check(
      "stock_movement_note_len",
      sql`${tableColumns.note} is null or length(${tableColumns.note}) <= 200`,
    ),
  ],
);
