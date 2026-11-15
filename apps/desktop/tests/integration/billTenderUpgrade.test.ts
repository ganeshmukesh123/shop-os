import { CoreError } from "@shopos/core";
import { BillRepository } from "../../src/main/repositories/BillRepository";
import { createTestDb } from "../helpers/testDb";
import { upgradeDatabaseWithOneBill } from "../helpers/upgradeFixture";

/** Task T077 (migration 0009): the payment mode becomes a tender row; lines take the target names. */
describe("upgrading bill lines and tenders from migration 0004 (research D18)", () => {
  it("gives the old bill one tender: its payment mode, the whole total, as a label", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const tenderRows = sqlite.prepare("select mode, amount_paise, status from bill_tender").all();

    expect(tenderRows).toEqual([{ mode: "cash", amount_paise: 24000, status: "label" }]);
  });

  it("ties the tender to the bill, and the bill no longer carries a payment mode", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const tiedRow = sqlite
      .prepare("select bill_tender.bill_id = bill.id as is_tied from bill_tender, bill")
      .get();
    const billColumns = (sqlite.pragma("table_info(bill)") as { name: string }[]).map(
      (column) => column.name,
    );

    expect(tiedRow).toEqual({ is_tied: 1 });
    expect(billColumns).not.toContain("payment_mode");
  });

  it("keeps the line under its new names", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const lineRow = sqlite
      .prepare(
        "select variant_id, qty_base_milli, unit_price_paise, line_discount_paise, amount_paise, item_name_snapshot from bill_line",
      )
      .get();

    expect(lineRow).toEqual({
      variant_id: "item-1",
      qty_base_milli: 2000,
      unit_price_paise: 12000,
      line_discount_paise: 0,
      amount_paise: 24000,
      item_name_snapshot: "Pipe",
    });
  });

  it("keeps a healthy file and the bill's own protection", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(() => sqlite.prepare("delete from bill").run()).toThrow(/cannot be deleted/);
    expect(() => sqlite.prepare("update bill set bill_no = 'X'").run()).toThrow(
      /can only be cancelled/,
    );
  });

  it("refuses to change or delete a tender", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(() => sqlite.prepare("update bill_tender set amount_paise = 1").run()).toThrow(
      /bill_tender is immutable/,
    );
    expect(() => sqlite.prepare("delete from bill_tender").run()).toThrow(
      /bill_tender is immutable/,
    );
  });
});

describe("tender rules in the database", () => {
  const insertTender = (overrides: Record<string, string | number>) => {
    const { sqlite, ctx } = createTestDb();
    sqlite
      .prepare(
        `insert into bill (id, business_id, shop_id, created_at, updated_at, device_id, counter_code, bill_no, financial_year, seq, bill_date, subtotal_paise, bill_discount_paise, total_paise, status)
         values ('bill-1', ?, ?, 'now', 'now', 'device-1', 'C1', 'C1/26-27/000001', '26-27', 1, '2026-11-15T10:00:00', 100, 0, 100, 'posted')`,
      )
      .run(ctx.businessId, ctx.shopId);
    sqlite
      .prepare(
        `insert into bill_tender (id, business_id, shop_id, created_at, updated_at, bill_id, mode, amount_paise, status)
         values ('tender-1', @businessId, @shopId, 'now', 'now', 'bill-1', @mode, @amountPaise, @status)`,
      )
      .run({
        businessId: ctx.businessId,
        shopId: ctx.shopId,
        mode: "upi",
        amountPaise: 100,
        status: "label",
        ...overrides,
      });
  };

  it("accepts each payment mode as a label", () => {
    expect(() => insertTender({ mode: "cash" })).not.toThrow();
    expect(() => insertTender({ mode: "unpaid" })).not.toThrow();
  });

  it("refuses an unknown mode, a negative amount, or a status other than label", () => {
    expect(() => insertTender({ mode: "cheque" })).toThrow(/bill_tender_mode/);
    expect(() => insertTender({ amountPaise: -1 })).toThrow(/bill_tender_amount_nonneg/);
    expect(() => insertTender({ status: "paid" })).toThrow(/bill_tender_status/);
  });
});

describe("BillRepository and the tender", () => {
  it("fails loudly for a bill that has no payment record", () => {
    const { sqlite, db, ctx } = createTestDb();
    sqlite
      .prepare(
        `insert into bill (id, business_id, shop_id, created_at, updated_at, device_id, counter_code, bill_no, financial_year, seq, bill_date, subtotal_paise, bill_discount_paise, total_paise, status)
         values ('bill-1', ?, ?, 'now', 'now', 'device-1', 'C1', 'C1/26-27/000001', '26-27', 1, '2026-11-15T10:00:00', 100, 0, 100, 'posted')`,
      )
      .run(ctx.businessId, ctx.shopId);

    const readBill = () => new BillRepository(db, ctx).get("bill-1");

    expect(readBill).toThrow(CoreError);
    expect(readBill).toThrow(/no payment record/);
  });
});
