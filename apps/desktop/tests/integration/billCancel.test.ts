import { CoreError } from "@shopos/core";
import { BillRepository } from "../../src/main/repositories/BillRepository";
import { StockRepository } from "../../src/main/repositories/StockRepository";
import { BillingService } from "../../src/main/services/BillingService";
import { InventoryService } from "../../src/main/services/InventoryService";
import { createTestDb, type TestDb } from "../helpers/testDb";

// 10:00 UTC is 15:30 in the shop's zone: explicit instants keep the tests machine-independent.
const SALE_TIME = new Date(Date.UTC(2026, 11, 7, 10, 0));
const CANCEL_TIME = new Date(Date.UTC(2026, 11, 7, 11, 0));

let testDb: TestDb;
let inventory: InventoryService;
let billing: BillingService;
let stock: StockRepository;

beforeEach(() => {
  testDb = createTestDb();
  inventory = new InventoryService(testDb.db, testDb.ctx);
  billing = new BillingService(testDb.db, testDb.ctx);
  stock = new StockRepository(testDb.db, testDb.ctx);
});

const createItem = (name: string, openingQtyMilli = 10000) =>
  inventory.createItem({ name, unit: "pcs", pricePaise: 12000, openingQtyMilli }).item;

const stockOf = (itemId: string): number =>
  inventory
    .listItems({ limit: 100, offset: 0, includeInactive: true })
    .items.find((item) => item.id === itemId)!.stockMilli;

const errorCodeOf = (action: () => unknown): string | undefined => {
  try {
    action();
  } catch (caughtError) {
    return caughtError instanceof CoreError ? caughtError.code : `other:${String(caughtError)}`;
  }
  return undefined;
};

function sell(lines: { itemId: string; quantityMilli: number }[], now = SALE_TIME) {
  return billing.saveBill(
    {
      clientBillId: crypto.randomUUID(),
      paymentMode: "cash",
      billDiscountPaise: 0,
      lines: lines.map((saleLine) => ({
        ...saleLine,
        ratePaise: 12000,
        lineDiscountPaise: 0,
      })),
    },
    now,
  ).bill;
}

const countRows = (tableName: string, where = "1 = 1"): number =>
  (
    testDb.sqlite.prepare(`select count(*) as rowCount from ${tableName} where ${where}`).get() as {
      rowCount: number;
    }
  ).rowCount;

describe("cancelling a bill (T064, FR-017)", () => {
  it("needs a reason that is not empty or only spaces, and changes nothing without one", () => {
    const pipe = createItem("Pipe");
    const soldBill = sell([{ itemId: pipe.id, quantityMilli: 2000 }]);

    const emptyReason = errorCodeOf(() => billing.cancelBill({ id: soldBill.id, reason: "" }));
    const blankReason = errorCodeOf(() => billing.cancelBill({ id: soldBill.id, reason: "   " }));

    expect(emptyReason).toBe("REASON_REQUIRED");
    expect(blankReason).toBe("REASON_REQUIRED");
    expect(billing.getBill(soldBill.id).bill.status).toBe("posted");
    expect(countRows("stock_movement", "movement_type = 'sale_cancel'")).toBe(0);
    expect(stockOf(pipe.id)).toBe(8000);
  });

  it("marks the bill Cancelled with the reason and time, and keeps its number and totals", () => {
    const pipe = createItem("Pipe");
    const soldBill = sell([{ itemId: pipe.id, quantityMilli: 2000 }]);

    const { bill: cancelledBill } = billing.cancelBill(
      { id: soldBill.id, reason: "  Wrong item  " },
      CANCEL_TIME,
    );

    expect(cancelledBill).toMatchObject({
      id: soldBill.id,
      number: soldBill.number,
      status: "cancelled",
      cancelReason: "Wrong item",
      cancelledAt: CANCEL_TIME.toISOString(),
      grandTotalPaise: 24000,
      paymentMode: "cash",
    });
    expect(billing.getBill(soldBill.id).bill).toEqual(cancelledBill);
  });

  it("keeps the bill's lines and tender exactly as they were", () => {
    const pipe = createItem("Pipe");
    const soldBill = sell([{ itemId: pipe.id, quantityMilli: 2000 }]);
    const linesBefore = new BillRepository(testDb.db, testDb.ctx).get(soldBill.id)!.lines;

    billing.cancelBill({ id: soldBill.id, reason: "Wrong item" });

    expect(billing.getBill(soldBill.id).lines).toEqual(linesBefore);
    expect(countRows("bill_tender", `bill_id = '${soldBill.id}'`)).toBe(1);
  });

  it("adds one equal and opposite sale_cancel movement per line, and never removes the sale", () => {
    const pipe = createItem("Pipe");
    const cable = createItem("Cable");
    const soldBill = sell([
      { itemId: pipe.id, quantityMilli: 2000 },
      { itemId: cable.id, quantityMilli: 3000 },
    ]);

    billing.cancelBill({ id: soldBill.id, reason: "Customer left" });

    const movements = stock.forBill(soldBill.id);
    const summary = movements
      .map((movement) => [movement.itemId, movement.reason, movement.quantityMilli])
      .sort();
    expect(summary).toEqual(
      [
        [pipe.id, "sale", -2000],
        [pipe.id, "sale_cancel", 2000],
        [cable.id, "sale", -3000],
        [cable.id, "sale_cancel", 3000],
      ].sort(),
    );
  });

  it("brings each item's stock back to what it was before the sale, equal to its movements", () => {
    const pipe = createItem("Pipe");
    const cable = createItem("Cable", 5000);
    const soldBill = sell([
      { itemId: pipe.id, quantityMilli: 2000 },
      { itemId: cable.id, quantityMilli: 3000 },
    ]);
    expect(stockOf(pipe.id)).toBe(8000);

    billing.cancelBill({ id: soldBill.id, reason: "Customer left" });

    expect(stockOf(pipe.id)).toBe(10000);
    expect(stockOf(cable.id)).toBe(5000);
    expect(stock.sumForItem(pipe.id)).toBe(10000);
    expect(stock.sumForItem(cable.id)).toBe(5000);
  });

  it("restores stock that went negative, and for an item deactivated since the sale", () => {
    const pipe = createItem("Pipe", 1000);
    const soldBill = sell([{ itemId: pipe.id, quantityMilli: 3000 }]);
    expect(stockOf(pipe.id)).toBe(-2000);
    inventory.updateItem({ id: pipe.id, active: false });

    billing.cancelBill({ id: soldBill.id, reason: "Wrong customer" });

    expect(stockOf(pipe.id)).toBe(1000);
  });

  it("never reuses the cancelled number: the next bill takes the next sequence", () => {
    const pipe = createItem("Pipe", 100000);
    sell([{ itemId: pipe.id, quantityMilli: 1000 }]);
    const secondBill = sell([{ itemId: pipe.id, quantityMilli: 1000 }]);

    billing.cancelBill({ id: secondBill.id, reason: "Wrong item" });
    const thirdBill = sell([{ itemId: pipe.id, quantityMilli: 1000 }]);

    expect([secondBill.seq, thirdBill.seq]).toEqual([2, 3]);
    expect(thirdBill.number).not.toBe(secondBill.number);
    expect(thirdBill.number.endsWith("000003")).toBe(true);
  });

  it("refuses a second cancel with ALREADY_CANCELLED and changes nothing", () => {
    const pipe = createItem("Pipe");
    const soldBill = sell([{ itemId: pipe.id, quantityMilli: 2000 }]);
    const firstCancel = billing.cancelBill(
      { id: soldBill.id, reason: "First reason" },
      CANCEL_TIME,
    );
    const movementsAfterFirst = stock.forBill(soldBill.id).length;

    const secondCancel = errorCodeOf(() =>
      billing.cancelBill({ id: soldBill.id, reason: "Second reason" }),
    );

    expect(secondCancel).toBe("ALREADY_CANCELLED");
    expect(billing.getBill(soldBill.id).bill).toEqual(firstCancel.bill);
    expect(stock.forBill(soldBill.id)).toHaveLength(movementsAfterFirst);
    expect(stockOf(pipe.id)).toBe(10000);
  });

  it("refuses a bill that does not exist with NOT_FOUND", () => {
    const errorCode = errorCodeOf(() => billing.cancelBill({ id: "missing", reason: "Any" }));

    expect(errorCode).toBe("NOT_FOUND");
  });

  it("leaves nothing half done when a movement cannot be written", () => {
    const pipe = createItem("Pipe");
    const cable = createItem("Cable");
    const soldBill = sell([
      { itemId: pipe.id, quantityMilli: 2000 },
      { itemId: cable.id, quantityMilli: 3000 },
    ]);
    testDb.sqlite.exec(`create trigger boom before insert on stock_movement
      when new.movement_type = 'sale_cancel' and new.variant_id = '${cable.id}'
      begin select raise(abort, 'boom'); end;`);

    expect(() => billing.cancelBill({ id: soldBill.id, reason: "Wrong item" })).toThrow(/boom/);

    expect(billing.getBill(soldBill.id).bill.status).toBe("posted");
    expect(billing.getBill(soldBill.id).bill.cancelReason).toBeNull();
    expect(countRows("stock_movement", "movement_type = 'sale_cancel'")).toBe(0);
    expect(stockOf(pipe.id)).toBe(8000);
    expect(stockOf(cable.id)).toBe(7000);
  });
});

describe("what the database refuses after a bill is saved or cancelled (FR-018)", () => {
  function saveAndCancelOneBill() {
    const pipe = createItem("Pipe");
    const soldBill = sell([{ itemId: pipe.id, quantityMilli: 2000 }]);
    billing.cancelBill({ id: soldBill.id, reason: "Wrong item" });
    return soldBill.id;
  }
  const run =
    (statement: string, ...bindings: string[]) =>
    () =>
      testDb.sqlite.prepare(statement).run(...bindings);

  it("refuses to delete a bill", () => {
    const billId = saveAndCancelOneBill();

    expect(run("delete from bill where id = ?", billId)).toThrow(/cannot be deleted/);
  });

  it("refuses to change a bill's totals, number or reason, or to reopen it", () => {
    const billId = saveAndCancelOneBill();

    expect(
      run("update bill set total_paise = 1, subtotal_paise = 1 where id = ?", billId),
    ).toThrow();
    expect(run("update bill set bill_no = 'X/1' where id = ?", billId)).toThrow();
    expect(run("update bill set cancel_reason = 'Another' where id = ?", billId)).toThrow();
    expect(run("update bill set status = 'posted' where id = ?", billId)).toThrow();
  });

  it("refuses to update or delete a bill line or a tender", () => {
    const billId = saveAndCancelOneBill();

    expect(run("update bill_line set amount_paise = 1 where bill_id = ?", billId)).toThrow(
      /immutable/,
    );
    expect(run("delete from bill_line where bill_id = ?", billId)).toThrow(/immutable/);
    expect(run("update bill_tender set amount_paise = 1 where bill_id = ?", billId)).toThrow(
      /immutable/,
    );
    expect(run("delete from bill_tender where bill_id = ?", billId)).toThrow(/immutable/);
  });

  it("refuses to update or delete any stock movement, the cancel's included", () => {
    const billId = saveAndCancelOneBill();

    expect(run("update stock_movement set qty_base_milli = 1 where doc_id = ?", billId)).toThrow(
      /append-only/,
    );
    expect(run("delete from stock_movement where doc_id = ?", billId)).toThrow(/append-only/);
  });
});
