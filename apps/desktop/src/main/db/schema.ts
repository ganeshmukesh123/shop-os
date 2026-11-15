import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Columns every table carries (data-model.md conventions). */
const base = {
  id: text("id").primaryKey(), // UUID v7
  businessId: text("business_id").notNull(),
  shopId: text("shop_id").notNull(),
  createdAt: text("created_at").notNull(), // ISO-8601 UTC
  updatedAt: text("updated_at").notNull(),
};

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

export const bill = sqliteTable(
  "bill",
  {
    ...base,
    // The id of the device that saved the bill (the shop profile's device id on this release)
    deviceId: text("device_id").notNull(),
    // counter_code: the counter or series the bill was made at, for example C1
    counterCode: text("counter_code").notNull(),
    billNo: text("bill_no").notNull(),
    financialYear: text("financial_year").notNull(),
    seq: integer("seq").notNull(),
    billDate: text("bill_date").notNull(), // ISO-8601 local timestamp
    customerName: text("customer_name"),
    // Idempotency key from the screen that started the bill; unique per shop. Null only for bills saved before it existed.
    clientBillId: text("client_bill_id"),
    subtotalPaise: integer("subtotal_paise").notNull(),
    billDiscountPaise: integer("bill_discount_paise").notNull(),
    totalPaise: integer("total_paise").notNull(),
    // status: posted or cancelled
    status: text("status").notNull(),
    cancelReason: text("cancel_reason"),
    cancelledAt: text("cancelled_at"),
  },
  (tableColumns) => [
    uniqueIndex("bill_no_uq").on(tableColumns.shopId, tableColumns.billNo),
    uniqueIndex("bill_counter_fy_seq_uq").on(
      tableColumns.counterCode,
      tableColumns.financialYear,
      tableColumns.seq,
    ),
    uniqueIndex("bill_client_bill_id_uq").on(tableColumns.shopId, tableColumns.clientBillId),
    index("bill_date_idx").on(tableColumns.billDate),
    index("bill_customer_idx").on(tableColumns.customerName),
    check("bill_no_len", sql`length(${tableColumns.billNo}) <= 16`),
    check("bill_status", sql`${tableColumns.status} in ('posted','cancelled')`),
    check(
      "bill_cancel_reason_required",
      sql`${tableColumns.status} <> 'cancelled' or (${tableColumns.cancelReason} is not null and length(trim(${tableColumns.cancelReason})) > 0)`,
    ),
    check(
      "bill_discount_range",
      sql`${tableColumns.billDiscountPaise} >= 0 and ${tableColumns.billDiscountPaise} <= ${tableColumns.subtotalPaise}`,
    ),
    check(
      "bill_total_eq",
      sql`${tableColumns.totalPaise} = ${tableColumns.subtotalPaise} - ${tableColumns.billDiscountPaise}`,
    ),
  ],
);

export const billLine = sqliteTable(
  "bill_line",
  {
    ...base,
    billId: text("bill_id")
      .notNull()
      .references(() => bill.id),
    lineNo: integer("line_no").notNull(),
    variantId: text("variant_id")
      .notNull()
      .references(() => itemVariant.id),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    unitSnapshot: text("unit_snapshot").notNull(),
    // qty_base_milli: integer, not null, greater than 0
    qtyBaseMilli: integer("qty_base_milli").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    lineDiscountPaise: integer("line_discount_paise").notNull(),
    amountPaise: integer("amount_paise").notNull(),
  },
  (tableColumns) => [
    index("bill_line_bill_idx").on(tableColumns.billId),
    check("bill_line_qty_pos", sql`${tableColumns.qtyBaseMilli} > 0`),
    check("bill_line_price_nonneg", sql`${tableColumns.unitPricePaise} >= 0`),
    check("bill_line_discount_nonneg", sql`${tableColumns.lineDiscountPaise} >= 0`),
  ],
);

// One row per bill in this release: how the customer paid, as a label only. Append-only.
export const billTender = sqliteTable(
  "bill_tender",
  {
    ...base,
    billId: text("bill_id")
      .notNull()
      .references(() => bill.id),
    // mode: one of cash, upi, card, unpaid
    mode: text("mode").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    // status: 'label' in this release (the shop records the mode, the app does not collect money)
    status: text("status").notNull(),
  },
  (tableColumns) => [
    index("bill_tender_bill_idx").on(tableColumns.billId),
    check("bill_tender_mode", sql`${tableColumns.mode} in ('cash','upi','card','unpaid')`),
    check("bill_tender_amount_nonneg", sql`${tableColumns.amountPaise} >= 0`),
    check("bill_tender_status", sql`${tableColumns.status} in ('label')`),
  ],
);

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
    occurredAt: text("occurred_at").notNull(),
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
      sql`(${tableColumns.docType} is null) = (${tableColumns.docId} is null) and (${tableColumns.docType} is null or ${tableColumns.docType} = 'bill')`,
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

export const shopProfile = sqliteTable(
  "shop_profile",
  {
    ...base,
    name: text("name").notNull(), // required, up to 80
    address: text("address").notNull().default(""), // up to 200
    phone: text("phone").notNull().default(""), // up to 20
    seriesCode: text("series_code").notNull().default("C1"),
    numberTemplate: text("number_template").notNull().default("{series}/{fy}/{seq}"),
    footer: text("footer").notNull().default(""), // up to 200
    receiptWidth: text("receipt_width").notNull().default("80mm"),
    backupFolder: text("backup_folder").notNull().default(""),
    deviceId: text("device_id").notNull(),
  },
  (tableColumns) => [
    check("shop_profile_name_len", sql`length(${tableColumns.name}) between 1 and 80`),
    check("shop_profile_address_len", sql`length(${tableColumns.address}) <= 200`),
    check("shop_profile_phone_len", sql`length(${tableColumns.phone}) <= 20`),
    check("shop_profile_footer_len", sql`length(${tableColumns.footer}) <= 200`),
    check("shop_profile_width", sql`${tableColumns.receiptWidth} in ('58mm','80mm')`),
  ],
);

export const numberCounter = sqliteTable(
  "number_counter",
  {
    ...base,
    seriesCode: text("series_code").notNull(),
    financialYear: text("financial_year").notNull(),
    lastSeq: integer("last_seq").notNull(),
  },
  (tableColumns) => [
    uniqueIndex("number_counter_uq").on(tableColumns.seriesCode, tableColumns.financialYear),
  ],
);

export const draftBill = sqliteTable("draft_bill", {
  ...base,
  payload: text("payload").notNull(), // JSON; not a financial record
});

export const backupLog = sqliteTable(
  "backup_log",
  {
    ...base,
    path: text("path").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    status: text("status").notNull(),
    error: text("error"),
  },
  (tableColumns) => [check("backup_log_status", sql`${tableColumns.status} in ('ok','failed')`)],
);
