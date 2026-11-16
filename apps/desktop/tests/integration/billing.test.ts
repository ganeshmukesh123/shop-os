import { CoreError } from "@shopos/core";
import { BillingService } from "../../src/main/services/BillingService";
import { InventoryService } from "../../src/main/services/InventoryService";
import { SettingsService } from "../../src/main/services/SettingsService";
import { BillRepository } from "../../src/main/repositories/BillRepository";
import { StockRepository } from "../../src/main/repositories/StockRepository";
import { createTestDb, type TestDb } from "../helpers/testDb";

let testDb: TestDb;
let inv: InventoryService;
let billing: BillingService;

beforeEach(() => {
  testDb = createTestDb();
  inv = new InventoryService(testDb.db, testDb.ctx);
  billing = new BillingService(testDb.db, testDb.ctx);
});

const mk = (name: string, unit = "pcs", price = 10000, qty = 10000) =>
  inv.createItem({ name, unit, pricePaise: price, openingQtyMilli: qty }).item;

const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (caughtError) {
    return caughtError instanceof CoreError ? caughtError.code : `other:${String(caughtError)}`;
  }
  return undefined;
};

const line = (itemId: string, quantityMilli = 1000, rate = 10000, disc = 0) => ({
  itemId,
  quantityMilli: quantityMilli,
  ratePaise: rate,
  lineDiscountPaise: disc,
});
const bill = (lines: ReturnType<typeof line>[], extra: object = {}) => ({
  clientBillId: crypto.randomUUID(),
  paymentMode: "cash" as const,
  billDiscountPaise: 0,
  lines,
  ...extra,
});

describe("billing", () => {
  it("saves bill, lines and one sale movement per line, and reduces stock", () => {
    const firstItem = mk("A");
    const secondItem = mk("B", "metre", 5000, 20000);
    const saveResult = billing.saveBill(
      bill([line(firstItem.id, 2000), line(secondItem.id, 2500, 5000)], {
        customerName: "Ravi",
      }),
    );
    expect(saveResult.bill.status).toBe("saved");
    expect(saveResult.bill.linesTotalPaise).toBe(20000 + 12500);
    expect(saveResult.bill.grandTotalPaise).toBe(32500);
    expect(saveResult.bill.customerName).toBe("Ravi");
    const got = new BillRepository(testDb.db, testDb.ctx).get(saveResult.bill.id)!;
    expect(got.lines).toHaveLength(2);
    expect(got.lines[0]).toMatchObject({
      lineNo: 1,
      itemNameSnapshot: "A",
      unitSnapshot: "pcs",
      amountPaise: 20000,
    });
    const moves = new StockRepository(testDb.db, testDb.ctx).forBill(saveResult.bill.id);
    expect(moves.map((movement) => [movement.reason, movement.quantityMilli]).sort()).toEqual(
      [
        ["sale", -2500],
        ["sale", -2000],
      ].sort(),
    );
    expect(
      inv.listItems({ limit: 10, offset: 0 }).items.find((item) => item.id === firstItem.id)!
        .stockMilli,
    ).toBe(8000);
    expect(
      inv.listItems({ limit: 10, offset: 0 }).items.find((item) => item.id === secondItem.id)!
        .stockMilli,
    ).toBe(17500);
  });

  it("applies line and bill discounts to totals", () => {
    const firstItem = mk("A");
    const saveResult = billing.saveBill(
      bill([line(firstItem.id, 3000, 10000, 1000)], { billDiscountPaise: 500 }),
    );
    expect(saveResult.bill.linesTotalPaise).toBe(29000);
    expect(saveResult.bill.billDiscountPaise).toBe(500);
    expect(saveResult.bill.grandTotalPaise).toBe(28500);
  });

  it("rejects an empty bill", () => {
    expect(code(() => billing.saveBill(bill([])))).toBe("EMPTY_BILL");
  });

  it("rejects zero or negative quantity, big discounts, and inactive items", () => {
    const firstItem = mk("A");
    expect(code(() => billing.saveBill(bill([line(firstItem.id, 0)])))).toBe("INVALID_QUANTITY");
    expect(code(() => billing.saveBill(bill([line(firstItem.id, -1000)])))).toBe(
      "INVALID_QUANTITY",
    );
    expect(code(() => billing.saveBill(bill([line(firstItem.id, 1000, 10000, 10001)])))).toBe(
      "INVALID_DISCOUNT",
    );
    expect(
      code(() => billing.saveBill(bill([line(firstItem.id)], { billDiscountPaise: 10001 }))),
    ).toBe("INVALID_DISCOUNT");
    expect(code(() => billing.saveBill(bill([line(firstItem.id, 1500)])))).toBe("INVALID_QUANTITY"); // pcs is whole only
    inv.updateItem({ id: firstItem.id, active: false });
    expect(code(() => billing.saveBill(bill([line(firstItem.id)])))).toBe("ITEM_INACTIVE");
    expect(code(() => billing.saveBill(bill([line("missing")])))).toBe("NOT_FOUND");
  });

  it("a failure mid-save leaves nothing behind", () => {
    const firstItem = mk("A");
    const secondItem = mk("B");
    testDb.sqlite.exec(`create trigger boom before insert on stock_movement
      when new.movement_type = 'sale' and new.variant_id = '${secondItem.id}' begin select raise(abort, 'boom'); end;`);
    expect(() => billing.saveBill(bill([line(firstItem.id), line(secondItem.id)]))).toThrow(/boom/);
    expect(testDb.sqlite.prepare("select count(*) as rowCount from bill").get()).toEqual({
      rowCount: 0,
    });
    expect(testDb.sqlite.prepare("select count(*) as rowCount from bill_line").get()).toEqual({
      rowCount: 0,
    });
    expect(
      testDb.sqlite
        .prepare("select count(*) as rowCount from stock_movement where movement_type='sale'")
        .get(),
    ).toEqual({ rowCount: 0 });
    expect(testDb.sqlite.prepare("select count(*) as rowCount from number_counter").get()).toEqual({
      rowCount: 0,
    });
    expect(
      inv.listItems({ limit: 10, offset: 0 }).items.find((item) => item.id === firstItem.id)!
        .stockMilli,
    ).toBe(10000);
  });

  it("numbers are sequential and unique across 50 quick saves", () => {
    const firstItem = mk("A", "pcs", 100, 1_000_000);
    const nums = Array.from(
      { length: 50 },
      () => billing.saveBill(bill([line(firstItem.id)]), new Date(2026, 11, 7)).bill.number,
    );
    expect(new Set(nums).size).toBe(50);
    expect(nums[0]).toBe("C1/26-27/000001");
    expect(nums[49]).toBe("C1/26-27/000050");
  });

  it("restarts the sequence in a new financial year", () => {
    const firstItem = mk("A", "pcs", 100, 100000);
    billing.saveBill(bill([line(firstItem.id)]), new Date(2027, 2, 31));
    const next = billing.saveBill(bill([line(firstItem.id)]), new Date(2027, 3, 1));
    expect(next.bill.number).toBe("C1/27-28/000001");
  });

  it("uses the configured series and template", () => {
    new SettingsService(testDb.db, testDb.ctx).update({
      name: "Shop",
      address: "",
      phone: "",
      seriesCode: "B2",
      numberTemplate: "{series}-{seq}",
      footer: "",
      receiptWidth: "80mm",
      backupFolder: "",
    });
    const firstItem = mk("A");
    expect(billing.saveBill(bill([line(firstItem.id)])).bill.number).toBe("B2-000001");
  });

  it("selling more than stock succeeds and reports negativeStockItems", () => {
    const firstItem = mk("A", "pcs", 100, 2000);
    const saveResult = billing.saveBill(bill([line(firstItem.id, 5000)]));
    expect(saveResult.negativeStockItems.map((negativeStockItem) => negativeStockItem.id)).toEqual([
      firstItem.id,
    ]);
    const item = inv.listItems({ needsCorrection: true, limit: 10, offset: 0 }).items[0]!;
    expect(item.stockMilli).toBe(-3000);
  });

  it("an item with no stock recorded can still be billed", () => {
    const firstItem = mk("A", "pcs", 100, 0);
    expect(billing.saveBill(bill([line(firstItem.id)])).negativeStockItems).toHaveLength(1);
  });

  it("line snapshots keep the old name and unit after the item changes", () => {
    const firstItem = mk("Old name");
    const saveResult = billing.saveBill(bill([line(firstItem.id)]));
    inv.updateItem({ id: firstItem.id, name: "New name", unit: "box" });
    const got = new BillRepository(testDb.db, testDb.ctx).get(saveResult.bill.id)!;
    expect(got.lines[0]).toMatchObject({ itemNameSnapshot: "Old name", unitSnapshot: "pcs" });
  });

  it("stores the payment mode label and optional customer", () => {
    const firstItem = mk("A");
    const saveResult = billing.saveBill(bill([line(firstItem.id)], { paymentMode: "unpaid" }));
    expect(saveResult.bill.paymentMode).toBe("unpaid");
    expect(saveResult.bill.customerName).toBeNull();
  });

  it("saved bills and lines cannot be edited or deleted", () => {
    const firstItem = mk("A");
    const saveResult = billing.saveBill(bill([line(firstItem.id)]));
    expect(() =>
      testDb.sqlite
        .prepare(
          "update bill set grand_total_paise = 1, bill_discount_paise = 0, lines_total_paise = 1 where id = ?",
        )
        .run(saveResult.bill.id),
    ).toThrow();
    expect(() =>
      testDb.sqlite.prepare("delete from bill where id = ?").run(saveResult.bill.id),
    ).toThrow(/cannot be deleted/);
    expect(() =>
      testDb.sqlite
        .prepare("update bill_line set rate_paise = 1 where bill_id = ?")
        .run(saveResult.bill.id),
    ).toThrow(/immutable/);
    expect(() =>
      testDb.sqlite.prepare("delete from bill_line where bill_id = ?").run(saveResult.bill.id),
    ).toThrow(/immutable/);
  });

  it("saving clears the draft; drafts round trip", () => {
    const firstItem = mk("A");
    expect(billing.loadDraft()).toBeNull();
    billing.saveDraft({ lines: [1, 2] });
    billing.saveDraft({ lines: [3] });
    expect(billing.loadDraft()).toEqual({ lines: [3] });
    billing.saveBill(bill([line(firstItem.id)]));
    expect(billing.loadDraft()).toBeNull();
  });

  it("saving the same clientBillId twice returns the first bill and changes nothing", () => {
    const firstItem = mk("A", "pcs", 100, 10000);
    const retriedInput = bill([line(firstItem.id, 3000)]);
    const firstSave = billing.saveBill(retriedInput);
    const secondSave = billing.saveBill(retriedInput); // double-click, retry or crash-and-retry
    expect(secondSave.bill.id).toBe(firstSave.bill.id);
    expect(secondSave.bill.number).toBe(firstSave.bill.number);
    expect(secondSave.lines).toHaveLength(1);
    expect(testDb.sqlite.prepare("select count(*) as rowCount from bill").get()).toEqual({
      rowCount: 1,
    });
    expect(
      testDb.sqlite
        .prepare("select count(*) as rowCount from stock_movement where movement_type = 'sale'")
        .get(),
    ).toEqual({ rowCount: 1 });
    expect(
      inv.listItems({ limit: 10, offset: 0 }).items.find((item) => item.id === firstItem.id)!
        .stockMilli,
    ).toBe(7000); // reduced once, not twice
  });

  it("different clientBillIds create different bills with consecutive numbers", () => {
    const firstItem = mk("A");
    const firstSave = billing.saveBill(bill([line(firstItem.id)]));
    const secondSave = billing.saveBill(bill([line(firstItem.id)]));
    expect(secondSave.bill.id).not.toBe(firstSave.bill.id);
    expect(secondSave.bill.seq).toBe(firstSave.bill.seq + 1);
  });

  it("rejects a save without a valid clientBillId", () => {
    const firstItem = mk("A");
    const withoutId = { ...bill([line(firstItem.id)]), clientBillId: "not-a-uuid" };
    expect(() => billing.saveBill(withoutId)).toThrow();
  });

  it("totals match a manual calculation on a 20-bill set (SC-007)", () => {
    const firstItem = mk("A", "metre", 1234, 1_000_000_000);
    for (let billIndex = 1; billIndex <= 20; billIndex++) {
      const quantityMilli = billIndex * 250; // i/4 metre
      const gross = Math.floor((quantityMilli * 1234 + 500) / 1000); // manual round half up
      const saveResult = billing.saveBill(
        bill([line(firstItem.id, quantityMilli, 1234, billIndex % 5)], {
          billDiscountPaise: billIndex % 3,
        }),
      );
      expect(saveResult.bill.grandTotalPaise).toBe(gross - (billIndex % 5) - (billIndex % 3));
    }
  });
});
