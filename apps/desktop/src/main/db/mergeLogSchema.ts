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
import { itemVariant } from "./itemSchema";
import { exceptionKind } from "./lookupSchema";
import { base } from "./schemaBase";

/**
 * Item merges and data issues (spec 002 T020, migration 0020; data-model.md "item_merge_log",
 * "exception_event"). Triggers in 0020 make the merge log append-only and let an exception go
 * from open to resolved only.
 */
const jsonArray = (column: AnySQLiteColumn) =>
  sql`json_valid(${column}) and json_type(${column}) = 'array'`;

export const itemMergeLog = sqliteTable(
  "item_merge_log",
  {
    ...base,
    action: text("action").notNull(),
    survivorId: text("survivor_id")
      .notNull()
      .references(() => itemVariant.id),
    mergedId: text("merged_id")
      .notNull()
      .references(() => itemVariant.id),
    // For a reversal: the merge row it reverses (a merge is reversed once)
    mergeLogId: text("merge_log_id"),
    // [{ locationId, batchId, qtyMilli }] moved from merged to survivor, one per location and batch
    movedJson: text("moved_json").notNull().default("[]"),
    movedBatchIds: text("moved_batch_ids").notNull().default("[]"),
    movedBarcodeIds: text("moved_barcode_ids").notNull().default("[]"),
    movedSearchNameIds: text("moved_search_name_ids").notNull().default("[]"),
    // The moved barcode and search-name rows as they were, for a reversal to restore
    movedRowsJson: text("moved_rows_json").notNull().default("[]"),
    reason: text("reason").notNull(),
    userLabel: text("user_label").notNull(),
    // Merge rows: merged time + 30 days, epoch ms
    reversibleUntil: integer("reversible_until"),
  },
  (tableColumns) => [
    foreignKey({ columns: [tableColumns.mergeLogId], foreignColumns: [tableColumns.id] }),
    uniqueIndex("item_merge_log_reverses_once_uq").on(tableColumns.mergeLogId),
    index("item_merge_log_merged_idx").on(tableColumns.mergedId),
    check("item_merge_log_action_enum", sql`${tableColumns.action} in ('merge', 'reverse')`),
    check(
      "item_merge_log_two_variants",
      sql`${tableColumns.survivorId} <> ${tableColumns.mergedId}`,
    ),
    check(
      "item_merge_log_action_shape",
      sql`(${tableColumns.action} = 'merge' and ${tableColumns.mergeLogId} is null and ${tableColumns.reversibleUntil} is not null) or (${tableColumns.action} = 'reverse' and ${tableColumns.mergeLogId} is not null and ${tableColumns.reversibleUntil} is null)`,
    ),
    check(
      "item_merge_log_reason_len",
      sql`length(trim(${tableColumns.reason})) between 1 and 200 and length(${tableColumns.reason}) <= 200`,
    ),
    check("item_merge_log_moved_json_array", jsonArray(tableColumns.movedJson)),
    check("item_merge_log_moved_batches_array", jsonArray(tableColumns.movedBatchIds)),
    check("item_merge_log_moved_barcodes_array", jsonArray(tableColumns.movedBarcodeIds)),
    check("item_merge_log_moved_names_array", jsonArray(tableColumns.movedSearchNameIds)),
    check("item_merge_log_moved_rows_array", jsonArray(tableColumns.movedRowsJson)),
  ],
);

export const exceptionEvent = sqliteTable(
  "exception_event",
  {
    ...base,
    kind: text("kind").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectIds: text("subject_ids").notNull(),
    detail: text("detail"),
    status: text("status").notNull().default("open"),
    resolvedAt: integer("resolved_at"),
    resolutionNote: text("resolution_note"),
  },
  (tableColumns) => [
    foreignKey({
      columns: [tableColumns.businessId, tableColumns.kind],
      foreignColumns: [exceptionKind.businessId, exceptionKind.code],
    }),
    index("exception_event_status_idx").on(tableColumns.status),
    check("exception_event_subject_type", sql`${tableColumns.subjectType} in ('item_variant')`),
    check("exception_event_subject_ids_array", jsonArray(tableColumns.subjectIds)),
    check(
      "exception_event_detail_len",
      sql`${tableColumns.detail} is null or length(${tableColumns.detail}) <= 200`,
    ),
    check(
      "exception_event_status_shape",
      sql`(${tableColumns.status} = 'open' and ${tableColumns.resolvedAt} is null) or (${tableColumns.status} = 'resolved' and ${tableColumns.resolvedAt} is not null)`,
    ),
    check(
      "exception_event_note_len",
      sql`${tableColumns.resolutionNote} is null or length(${tableColumns.resolutionNote}) <= 200`,
    ),
  ],
);
