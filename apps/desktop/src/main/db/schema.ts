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

export const item = sqliteTable(
  "item",
  {
    ...base,
    // name: text, not null, 1-120 characters, trimmed
    name: text("name").notNull(),
    // unit: not null, one of pcs/metre/kg/litre/box or a custom name up to 20 characters
    unit: text("unit").notNull(),
    allowsDecimal: integer("allows_decimal").notNull().default(0),
    // price_paise: integer, not null, 0 or more
    pricePaise: integer("price_paise").notNull(),
    // stock_milli: cached sum of movements (may be negative)
    stockMilli: integer("stock_milli").notNull().default(0),
    active: integer("active").notNull().default(1),
    // Reserved, unused in MVP
    hsn: text("hsn"),
    gstRateBp: integer("gst_rate_bp"),
    barcode: text("barcode"),
  },
  (tableColumns) => ({
    item_name_nocase_idx: index("item_name_nocase_idx").on(
      sql`${tableColumns.name} COLLATE NOCASE`,
    ),
    item_name_len: check(
      "item_name_len",
      sql`length(${tableColumns.name}) between 1 and 120 and ${tableColumns.name} = trim(${tableColumns.name})`,
    ),
    item_unit_len: check("item_unit_len", sql`length(${tableColumns.unit}) between 1 and 20`),
    item_price_nonneg: check("item_price_nonneg", sql`${tableColumns.pricePaise} >= 0`),
    item_allows_decimal_bool: check(
      "item_allows_decimal_bool",
      sql`${tableColumns.allowsDecimal} in (0, 1)`,
    ),
    item_active_bool: check("item_active_bool", sql`${tableColumns.active} in (0, 1)`),
  }),
);

export const bill = sqliteTable(
  "bill",
  {
    ...base,
    number: text("number").notNull(),
    seriesCode: text("series_code").notNull(),
    financialYear: text("financial_year").notNull(),
    seq: integer("seq").notNull(),
    billDate: text("bill_date").notNull(), // ISO-8601 local timestamp
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    // payment_mode: one of cash, upi, card, unpaid
    paymentMode: text("payment_mode").notNull(),
    linesTotalPaise: integer("lines_total_paise").notNull(),
    billDiscountPaise: integer("bill_discount_paise").notNull(),
    grandTotalPaise: integer("grand_total_paise").notNull(),
    // status: saved or cancelled
    status: text("status").notNull(),
    cancelReason: text("cancel_reason"),
    cancelledAt: text("cancelled_at"),
  },
  (tableColumns) => ({
    bill_number_uq: uniqueIndex("bill_number_uq").on(tableColumns.shopId, tableColumns.number),
    bill_series_fy_seq_uq: uniqueIndex("bill_series_fy_seq_uq").on(
      tableColumns.seriesCode,
      tableColumns.financialYear,
      tableColumns.seq,
    ),
    bill_date_idx: index("bill_date_idx").on(tableColumns.billDate),
    bill_customer_idx: index("bill_customer_idx").on(tableColumns.customerName),
    bill_payment_mode: check(
      "bill_payment_mode",
      sql`${tableColumns.paymentMode} in ('cash','upi','card','unpaid')`,
    ),
    bill_status: check("bill_status", sql`${tableColumns.status} in ('saved','cancelled')`),
    bill_cancel_reason_required: check(
      "bill_cancel_reason_required",
      sql`${tableColumns.status} <> 'cancelled' or (${tableColumns.cancelReason} is not null and length(trim(${tableColumns.cancelReason})) > 0)`,
    ),
    bill_discount_range: check(
      "bill_discount_range",
      sql`${tableColumns.billDiscountPaise} >= 0 and ${tableColumns.billDiscountPaise} <= ${tableColumns.linesTotalPaise}`,
    ),
    bill_total_eq: check(
      "bill_total_eq",
      sql`${tableColumns.grandTotalPaise} = ${tableColumns.linesTotalPaise} - ${tableColumns.billDiscountPaise}`,
    ),
    bill_phone_digits: check(
      "bill_phone_digits",
      sql`${tableColumns.customerPhone} is null or (length(${tableColumns.customerPhone}) between 10 and 15 and ${tableColumns.customerPhone} not glob '*[^0-9]*')`,
    ),
  }),
);

export const billLine = sqliteTable(
  "bill_line",
  {
    ...base,
    billId: text("bill_id")
      .notNull()
      .references(() => bill.id),
    lineNo: integer("line_no").notNull(),
    itemId: text("item_id")
      .notNull()
      .references(() => item.id),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    unitSnapshot: text("unit_snapshot").notNull(),
    // quantity_milli: integer, not null, greater than 0
    quantityMilli: integer("quantity_milli").notNull(),
    ratePaise: integer("rate_paise").notNull(),
    lineDiscountPaise: integer("line_discount_paise").notNull(),
    amountPaise: integer("amount_paise").notNull(),
  },
  (tableColumns) => ({
    bill_line_bill_idx: index("bill_line_bill_idx").on(tableColumns.billId),
    bill_line_qty_pos: check("bill_line_qty_pos", sql`${tableColumns.quantityMilli} > 0`),
    bill_line_rate_nonneg: check("bill_line_rate_nonneg", sql`${tableColumns.ratePaise} >= 0`),
    bill_line_discount_nonneg: check(
      "bill_line_discount_nonneg",
      sql`${tableColumns.lineDiscountPaise} >= 0`,
    ),
  }),
);

export const stockMovement = sqliteTable(
  "stock_movement",
  {
    ...base,
    itemId: text("item_id")
      .notNull()
      .references(() => item.id),
    // quantity_milli: integer, not null, non-zero; positive adds stock, negative removes
    quantityMilli: integer("quantity_milli").notNull(),
    // reason: one of opening, adjustment, sale, sale_cancel
    reason: text("reason").notNull(),
    note: text("note"),
    billId: text("bill_id").references(() => bill.id),
    occurredAt: text("occurred_at").notNull(),
    deviceId: text("device_id").notNull(),
  },
  (tableColumns) => ({
    stock_movement_item_idx: index("stock_movement_item_idx").on(
      tableColumns.itemId,
      tableColumns.occurredAt,
    ),
    stock_movement_nonzero: check(
      "stock_movement_nonzero",
      sql`${tableColumns.quantityMilli} <> 0`,
    ),
    stock_movement_reason: check(
      "stock_movement_reason",
      sql`${tableColumns.reason} in ('opening','adjustment','sale','sale_cancel')`,
    ),
    stock_movement_note_len: check(
      "stock_movement_note_len",
      sql`${tableColumns.note} is null or length(${tableColumns.note}) <= 200`,
    ),
  }),
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
  (tableColumns) => ({
    shop_profile_name_len: check(
      "shop_profile_name_len",
      sql`length(${tableColumns.name}) between 1 and 80`,
    ),
    shop_profile_address_len: check(
      "shop_profile_address_len",
      sql`length(${tableColumns.address}) <= 200`,
    ),
    shop_profile_phone_len: check(
      "shop_profile_phone_len",
      sql`length(${tableColumns.phone}) <= 20`,
    ),
    shop_profile_footer_len: check(
      "shop_profile_footer_len",
      sql`length(${tableColumns.footer}) <= 200`,
    ),
    shop_profile_width: check(
      "shop_profile_width",
      sql`${tableColumns.receiptWidth} in ('58mm','80mm')`,
    ),
  }),
);

export const numberCounter = sqliteTable(
  "number_counter",
  {
    ...base,
    seriesCode: text("series_code").notNull(),
    financialYear: text("financial_year").notNull(),
    lastSeq: integer("last_seq").notNull(),
  },
  (tableColumns) => ({
    number_counter_uq: uniqueIndex("number_counter_uq").on(
      tableColumns.seriesCode,
      tableColumns.financialYear,
    ),
  }),
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
  (tableColumns) => ({
    backup_log_status: check("backup_log_status", sql`${tableColumns.status} in ('ok','failed')`),
  }),
);
