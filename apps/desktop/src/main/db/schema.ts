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
import { base } from "./schemaBase";

import { itemVariant } from "./itemSchema";
import { tenderMode, tenderStatus } from "./lookupSchema";

// Feature 002 tables live in their own files; drizzle-kit reads them through these re-exports.
export * from "./catalogueSchema";
export * from "./itemSchema";
export * from "./lookupSchema";
export * from "./stockSchema";
export * from "./variantDetailSchema";

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
    // The series this bill's number came from (counter, financial year, template)
    numberSeriesId: text("number_series_id")
      .notNull()
      .references(() => numberSeries.id),
    seq: integer("seq").notNull(),
    // billed_at: the UTC instant the bill was saved, epoch milliseconds
    billedAt: integer("billed_at").notNull(),
    // business_date: that instant's calendar date in the shop's time zone (YYYY-MM-DD), worked out once
    businessDate: text("business_date").notNull(),
    customerName: text("customer_name"),
    // Idempotency key from the screen that started the bill; unique per shop. Null only for bills saved before it existed.
    clientBillId: text("client_bill_id"),
    subtotalPaise: integer("subtotal_paise").notNull(),
    billDiscountPaise: integer("bill_discount_paise").notNull(),
    // round_off_paise: signed difference to the nearest rupee, 0 when rounding is off (FR-010a)
    roundOffPaise: integer("round_off_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull(),
    // doc_title: the heading printed on this bill, stored so a reprint is identical (FR-015a)
    docTitle: text("doc_title").notNull().default("Estimate"),
    // time_zone: the shop's zone when the bill was saved; its date and time are always shown in it,
    // so a reprint matches even after the shop changes its zone (FR-019a)
    timeZone: text("time_zone").notNull().default("Asia/Kolkata"),
    // status: posted or cancelled
    status: text("status").notNull(),
    cancelReason: text("cancel_reason"),
    cancelledAt: integer("cancelled_at"),
  },
  (tableColumns) => [
    uniqueIndex("bill_no_uq").on(tableColumns.shopId, tableColumns.billNo),
    uniqueIndex("bill_counter_fy_seq_uq").on(
      tableColumns.counterCode,
      tableColumns.financialYear,
      tableColumns.seq,
    ),
    uniqueIndex("bill_client_bill_id_uq").on(tableColumns.shopId, tableColumns.clientBillId),
    index("bill_business_date_idx").on(tableColumns.businessDate),
    index("bill_customer_idx").on(tableColumns.customerName),
    check("bill_no_len", sql`length(${tableColumns.billNo}) <= 16`),
    check(
      "bill_business_date_format",
      sql`${tableColumns.businessDate} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
    check("bill_status", sql`${tableColumns.status} in ('posted','cancelled')`),
    check(
      "bill_cancel_reason_required",
      sql`${tableColumns.status} <> 'cancelled' or (${tableColumns.cancelReason} is not null and length(trim(${tableColumns.cancelReason})) > 0)`,
    ),
    check(
      "bill_discount_range",
      sql`${tableColumns.billDiscountPaise} >= 0 and ${tableColumns.billDiscountPaise} <= ${tableColumns.subtotalPaise}`,
    ),
    check("bill_round_off_range", sql`abs(${tableColumns.roundOffPaise}) <= 50`),
    check(
      "bill_total_eq",
      sql`${tableColumns.totalPaise} = ${tableColumns.subtotalPaise} - ${tableColumns.billDiscountPaise} + ${tableColumns.roundOffPaise}`,
    ),
    check("bill_doc_title_len", sql`length(trim(${tableColumns.docTitle})) between 1 and 30`),
    check("bill_time_zone_len", sql`length(${tableColumns.timeZone}) between 1 and 64`),
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
    // mode: a tender_mode code (cash, upi, card, unpaid), a lookup since spec 002 T019
    mode: text("mode").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    // status: a tender_status code; 'label' in this release (the app does not collect money)
    status: text("status").notNull(),
  },
  (tableColumns) => [
    index("bill_tender_bill_idx").on(tableColumns.billId),
    foreignKey({
      columns: [tableColumns.businessId, tableColumns.mode],
      foreignColumns: [tenderMode.businessId, tenderMode.code],
    }),
    foreignKey({
      columns: [tableColumns.businessId, tableColumns.status],
      foreignColumns: [tenderStatus.businessId, tenderStatus.code],
    }),
    check("bill_tender_amount_nonneg", sql`${tableColumns.amountPaise} >= 0`),
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
    // The heading printed on every bill (FR-015a, research D23)
    docTitle: text("doc_title").notNull().default("Estimate"),
    // 1 = round the grand total to the nearest rupee (FR-010a, research D20)
    roundBillTotal: integer("round_bill_total").notNull().default(1),
    // The shop's named time zone for business dates (FR-019a, research D22)
    timeZone: text("time_zone").notNull().default("Asia/Kolkata"),
    // The screen's System, Light or Dark choice; null until first saved (spec 018 T035)
    theme: text("theme"),
  },
  (tableColumns) => [
    check("shop_profile_name_len", sql`length(${tableColumns.name}) between 1 and 80`),
    check("shop_profile_address_len", sql`length(${tableColumns.address}) <= 200`),
    check("shop_profile_phone_len", sql`length(${tableColumns.phone}) <= 20`),
    check("shop_profile_footer_len", sql`length(${tableColumns.footer}) <= 200`),
    check("shop_profile_width", sql`${tableColumns.receiptWidth} in ('58mm','80mm','a4','a5')`),
    check(
      "shop_profile_doc_title_len",
      sql`length(trim(${tableColumns.docTitle})) between 1 and 30`,
    ),
    check("shop_profile_round_bool", sql`${tableColumns.roundBillTotal} in (0, 1)`),
    check("shop_profile_time_zone_len", sql`length(${tableColumns.timeZone}) between 1 and 64`),
    check(
      "shop_profile_theme",
      sql`${tableColumns.theme} is null or ${tableColumns.theme} in ('system','light','dark')`,
    ),
  ],
);

export const numberSeries = sqliteTable(
  "number_series",
  {
    ...base,
    counterCode: text("counter_code").notNull(),
    financialYear: text("financial_year").notNull(),
    // The bill number template last used with this series, for example {series}/{fy}/{seq}
    template: text("template").notNull(),
    lastSeq: integer("last_seq").notNull(),
  },
  (tableColumns) => [
    uniqueIndex("number_series_uq").on(
      tableColumns.shopId,
      tableColumns.counterCode,
      tableColumns.financialYear,
    ),
  ],
);

// Bill numbers that a restore lost: numbers seq_from to seq_to of a series were printed but are not in the
// restored database, so they will never be issued again (FR-013b, EC-19, research D21). Append-only.
export const billNumberGap = sqliteTable(
  "bill_number_gap",
  {
    ...base,
    numberSeriesId: text("number_series_id")
      .notNull()
      .references(() => numberSeries.id),
    seqFrom: integer("seq_from").notNull(),
    seqTo: integer("seq_to").notNull(),
    // reason: 'lost_in_restore' in this release
    reason: text("reason").notNull(),
    // is_estimated: 1 when the owner could not say and the block of 100 was assumed (research D21),
    // 0 when they confirmed the last bill number; an audit must be able to tell the two apart
    isEstimated: integer("is_estimated").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (tableColumns) => [
    index("bill_number_gap_series_idx").on(tableColumns.numberSeriesId, tableColumns.seqFrom),
    check(
      "bill_number_gap_range",
      sql`${tableColumns.seqFrom} >= 1 and ${tableColumns.seqTo} >= ${tableColumns.seqFrom}`,
    ),
    check("bill_number_gap_reason", sql`${tableColumns.reason} in ('lost_in_restore')`),
    check("bill_number_gap_estimated_bool", sql`${tableColumns.isEstimated} in (0, 1)`),
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
