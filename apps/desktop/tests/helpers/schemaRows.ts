import type Database from "better-sqlite3";
import type { Ctx } from "../../src/main/db/seed";

const EPOCH_MS = 1_794_600_000_000; // a fixed instant in November 2026
const ISO_TIME = "2026-11-15T09:30:00.000Z";

/** Binding values accepted by better-sqlite3 for one column. */
type ColumnValue = string | number | null;

function insertRow(
  sqlite: Database.Database,
  tableName: string,
  rowValues: Record<string, ColumnValue>,
): void {
  const columnNames = Object.keys(rowValues);
  const placeholders = columnNames.map((columnName) => `@${columnName}`).join(", ");
  sqlite
    .prepare(`insert into ${tableName} (${columnNames.join(", ")}) values (${placeholders})`)
    .run(rowValues);
}

// ---------------------------------------------------------------------------------------------
// Target shape (data-model.md "Target shape"): used by the immutability tests once T078 lands.
// ---------------------------------------------------------------------------------------------

export interface ITargetBillIds {
  billId: string;
  lineId: string;
  tenderId: string;
  movementId: string;
  numberSeriesId: string;
  variantId: string;
}

function targetBase(ctx: Ctx, id: string): Record<string, ColumnValue> {
  return {
    id,
    business_id: ctx.businessId,
    shop_id: ctx.shopId,
    created_at: EPOCH_MS,
    updated_at: EPOCH_MS,
  };
}

/** One posted bill (2 pcs of Pipe at 120.00) with its line, cash tender, sale movement and series. */
export function insertTargetBill(sqlite: Database.Database, ctx: Ctx): ITargetBillIds {
  const ids: ITargetBillIds = {
    billId: "bill-1",
    lineId: "line-1",
    tenderId: "tender-1",
    movementId: "movement-1",
    numberSeriesId: "series-1",
    variantId: "variant-1",
  };
  const shopFloor = sqlite.prepare("select id from location where name = 'Shop floor'").get() as {
    id: string;
  };
  insertRow(sqlite, "item_family", { ...targetBase(ctx, "family-1"), name: "Pipe" });
  insertRow(sqlite, "item_variant", {
    ...targetBase(ctx, ids.variantId),
    family_id: "family-1",
    item_code: "ITM-0001",
    display_name: "Pipe",
    base_uom: "pcs",
    allow_decimal: 0,
    selling_price_paise: 12000,
    is_active: 1,
    stock_milli: -2000,
  });
  insertRow(sqlite, "number_series", {
    ...targetBase(ctx, ids.numberSeriesId),
    counter_code: "C1",
    financial_year: "26-27",
    template: "{series}/{fy}/{seq}",
    last_seq: 1,
  });
  insertRow(sqlite, "bill", {
    ...targetBase(ctx, ids.billId),
    device_id: "device-1",
    counter_code: "C1",
    bill_no: "C1/26-27/000001",
    number_series_id: ids.numberSeriesId,
    seq: 1,
    financial_year: "26-27",
    doc_title: "Estimate",
    status: "posted",
    business_date: "2026-11-15",
    billed_at: EPOCH_MS,
    customer_name: null,
    client_bill_id: "client-bill-1",
    subtotal_paise: 24000,
    bill_discount_paise: 0,
    round_off_paise: 0,
    total_paise: 24000,
    cancel_reason: null,
    cancelled_at: null,
  });
  insertRow(sqlite, "bill_line", {
    ...targetBase(ctx, ids.lineId),
    bill_id: ids.billId,
    line_no: 1,
    variant_id: ids.variantId,
    item_name_snapshot: "Pipe",
    unit_snapshot: "pcs",
    qty_base_milli: 2000,
    unit_price_paise: 12000,
    line_discount_paise: 0,
    amount_paise: 24000,
  });
  insertRow(sqlite, "bill_tender", {
    ...targetBase(ctx, ids.tenderId),
    bill_id: ids.billId,
    mode: "cash",
    amount_paise: 24000,
    status: "label",
  });
  insertRow(sqlite, "stock_movement", {
    ...targetBase(ctx, ids.movementId),
    variant_id: ids.variantId,
    movement_type: "sale",
    qty_base_milli: 2000,
    from_location_id: shopFloor.id,
    to_location_id: null,
    doc_type: "bill",
    doc_id: ids.billId,
    reason_code: null,
    note: null,
    device_id: "device-1",
    occurred_at: EPOCH_MS,
  });
  return ids;
}

/** A recorded gap in a bill-number series (research D21), once T083 lands. */
export function insertTargetNumberGap(
  sqlite: Database.Database,
  ctx: Ctx,
  numberSeriesId: string,
): string {
  insertRow(sqlite, "bill_number_gap", {
    ...targetBase(ctx, "gap-1"),
    number_series_id: numberSeriesId,
    seq_from: 121,
    seq_to: 126,
    reason: "lost_in_restore",
    recorded_at: EPOCH_MS,
  });
  return "gap-1";
}

// ---------------------------------------------------------------------------------------------
// Shape at migration 0004 (the schema in the code on 2026-11-15): the "before" of the upgrade.
// ---------------------------------------------------------------------------------------------

function oldBase(ctx: Ctx, id: string): Record<string, ColumnValue> {
  return {
    id,
    business_id: ctx.businessId,
    shop_id: ctx.shopId,
    created_at: ISO_TIME,
    updated_at: ISO_TIME,
  };
}

/**
 * Pipe: opening 10 pcs, then one saved bill of 2 pcs at 120.00 (total 240.00, stock 8 pcs).
 * Raw SQL on purpose: it must keep working whatever the services look like after the move.
 */
export function insertBillAtMigration0004(sqlite: Database.Database, ctx: Ctx): void {
  insertRow(sqlite, "item", {
    ...oldBase(ctx, "item-1"),
    name: "Pipe",
    unit: "pcs",
    allows_decimal: 0,
    price_paise: 12000,
    stock_milli: 8000,
    active: 1,
  });
  insertRow(sqlite, "number_counter", {
    ...oldBase(ctx, "counter-1"),
    series_code: "C1",
    financial_year: "26-27",
    last_seq: 1,
  });
  insertRow(sqlite, "bill", {
    ...oldBase(ctx, "bill-1"),
    number: "C1/26-27/000001",
    series_code: "C1",
    financial_year: "26-27",
    seq: 1,
    bill_date: "2026-11-15T15:00:00",
    customer_name: null,
    client_bill_id: "client-bill-1",
    payment_mode: "cash",
    lines_total_paise: 24000,
    bill_discount_paise: 0,
    grand_total_paise: 24000,
    status: "saved",
    cancel_reason: null,
    cancelled_at: null,
  });
  insertRow(sqlite, "bill_line", {
    ...oldBase(ctx, "line-1"),
    bill_id: "bill-1",
    line_no: 1,
    item_id: "item-1",
    item_name_snapshot: "Pipe",
    unit_snapshot: "pcs",
    quantity_milli: 2000,
    rate_paise: 12000,
    line_discount_paise: 0,
    amount_paise: 24000,
  });
  insertOldMovement(sqlite, ctx, { id: "movement-1", quantityMilli: 10000, reason: "opening" });
  insertOldMovement(sqlite, ctx, {
    id: "movement-2",
    quantityMilli: -2000,
    reason: "sale",
    billId: "bill-1",
  });
}

function insertOldMovement(
  sqlite: Database.Database,
  ctx: Ctx,
  movement: { id: string; quantityMilli: number; reason: string; billId?: string },
): void {
  insertRow(sqlite, "stock_movement", {
    ...oldBase(ctx, movement.id),
    item_id: "item-1",
    quantity_milli: movement.quantityMilli,
    reason: movement.reason,
    note: null,
    bill_id: movement.billId ?? null,
    occurred_at: ISO_TIME,
    device_id: "device-1",
  });
}
