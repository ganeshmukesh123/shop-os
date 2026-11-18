import {
  BillSearchRepository,
  MAX_BILL_PAGE_SIZE,
} from "../../src/main/repositories/BillSearchRepository";
import { BillingService } from "../../src/main/services/BillingService";
import { InventoryService } from "../../src/main/services/InventoryService";
import { createTestDb, type TestDb } from "../helpers/testDb";

// 10:00 UTC is 15:30 in the shop's zone, so each instant is on that calendar day there.
const DEC_7 = new Date(Date.UTC(2026, 11, 7, 10, 0));
const DEC_8 = new Date(Date.UTC(2026, 11, 8, 10, 0));
const DEC_9 = new Date(Date.UTC(2026, 11, 9, 10, 0));

let testDb: TestDb;
let billing: BillingService;
let bills: BillSearchRepository;
let pipeId: string;

beforeEach(() => {
  testDb = createTestDb();
  billing = new BillingService(testDb.db, testDb.ctx);
  bills = new BillSearchRepository(testDb.db, testDb.ctx);
  pipeId = new InventoryService(testDb.db, testDb.ctx).createItem({
    name: "Pipe",
    unit: "pcs",
    pricePaise: 12000,
    openingQtyMilli: 1_000_000,
  }).item.id;
});

function saveBill(options: { now: Date; customerName?: string; paymentMode?: "cash" | "upi" }) {
  return billing.saveBill(
    {
      clientBillId: crypto.randomUUID(),
      customerName: options.customerName,
      paymentMode: options.paymentMode ?? "cash",
      billDiscountPaise: 0,
      lines: [{ itemId: pipeId, quantityMilli: 1000, ratePaise: 12000, lineDiscountPaise: 0 }],
    },
    options.now,
  ).bill;
}

/** The only change the database allows on a saved bill: posted to cancelled. */
function markCancelled(billId: string): void {
  testDb.sqlite
    .prepare(
      "update bill set status = 'cancelled', cancel_reason = 'wrong item', cancelled_at = 1 where id = ?",
    )
    .run(billId);
}

const numbersOf = (listed: { bills: { number: string }[] }) =>
  listed.bills.map((listedBill) => listedBill.number);

describe("BillRepository.list (T067, FR-016)", () => {
  it("lists the newest bill first", () => {
    const first = saveBill({ now: DEC_7 });
    const second = saveBill({ now: DEC_8 });
    const third = saveBill({ now: DEC_9 });

    const listed = bills.list({ limit: 10, offset: 0 });

    expect(numbersOf(listed)).toEqual([third.number, second.number, first.number]);
    expect(listed.total).toBe(3);
  });

  it("finds a bill by part of its number", () => {
    saveBill({ now: DEC_7 });
    const second = saveBill({ now: DEC_7 });

    const listed = bills.list({ number: "000002", limit: 10, offset: 0 });

    expect(numbersOf(listed)).toEqual([second.number]);
  });

  it("includes both end days of a date range and nothing outside it", () => {
    saveBill({ now: DEC_7 });
    const insideFirst = saveBill({ now: DEC_8 });
    const insideSecond = saveBill({ now: DEC_9 });

    const listed = bills.list({ from: "2026-12-08", to: "2026-12-09", limit: 10, offset: 0 });

    expect(numbersOf(listed)).toEqual([insideSecond.number, insideFirst.number]);
  });

  it("accepts a range with only a start day or only an end day", () => {
    const early = saveBill({ now: DEC_7 });
    const late = saveBill({ now: DEC_9 });

    expect(numbersOf(bills.list({ from: "2026-12-09", limit: 10, offset: 0 }))).toEqual([
      late.number,
    ]);
    expect(numbersOf(bills.list({ to: "2026-12-07", limit: 10, offset: 0 }))).toEqual([
      early.number,
    ]);
  });

  it("finds a bill by part of the customer name, ignoring case", () => {
    saveBill({ now: DEC_7, customerName: "Mohan Traders" });
    const ravi = saveBill({ now: DEC_8, customerName: "Ravi Kumar" });

    const listed = bills.list({ customer: "rAvI", limit: 10, offset: 0 });

    expect(numbersOf(listed)).toEqual([ravi.number]);
  });

  it("treats % and _ in a search as plain characters", () => {
    const discounted = saveBill({ now: DEC_7, customerName: "50%_off shop" });
    saveBill({ now: DEC_8, customerName: "500 off shop" });

    const listed = bills.list({ customer: "50%_off", limit: 10, offset: 0 });

    expect(numbersOf(listed)).toEqual([discounted.number]);
  });

  it("treats a backslash in a search as a plain character", () => {
    saveBill({ now: DEC_7, customerName: "Shop A" });

    expect(bills.list({ customer: "\\", limit: 10, offset: 0 }).total).toBe(0);
  });

  it("filters by status", () => {
    const stays = saveBill({ now: DEC_7 });
    const cancelled = saveBill({ now: DEC_8 });
    markCancelled(cancelled.id);

    expect(numbersOf(bills.list({ status: "posted", limit: 10, offset: 0 }))).toEqual([
      stays.number,
    ]);
    expect(numbersOf(bills.list({ status: "cancelled", limit: 10, offset: 0 }))).toEqual([
      cancelled.number,
    ]);
  });

  it("combines filters, and total counts every match, not just the page", () => {
    saveBill({ now: DEC_7, customerName: "Ravi" });
    saveBill({ now: DEC_8, customerName: "Ravi" });
    saveBill({ now: DEC_9, customerName: "Ravi" });
    saveBill({ now: DEC_9, customerName: "Mohan" });

    const listed = bills.list({ customer: "Ravi", from: "2026-12-08", limit: 1, offset: 0 });

    expect(listed.bills).toHaveLength(1);
    expect(listed.total).toBe(2);
  });

  it("pages through the bills without repeating or skipping one", () => {
    const first = saveBill({ now: DEC_7 });
    const second = saveBill({ now: DEC_8 });
    const third = saveBill({ now: DEC_9 });

    const firstPage = bills.list({ limit: 2, offset: 0 });
    const secondPage = bills.list({ limit: 2, offset: 2 });

    expect(numbersOf(firstPage)).toEqual([third.number, second.number]);
    expect(numbersOf(secondPage)).toEqual([first.number]);
  });

  it("returns each bill's payment mode and cancel details", () => {
    const paidByUpi = saveBill({ now: DEC_7, paymentMode: "upi" });
    markCancelled(paidByUpi.id);

    const [listedBill] = bills.list({ limit: 10, offset: 0 }).bills;

    expect(listedBill).toMatchObject({
      number: paidByUpi.number,
      paymentMode: "upi",
      status: "cancelled",
      cancelReason: "wrong item",
      grandTotalPaise: 12000,
    });
  });

  it("returns nothing, with a total of 0, when no bill matches", () => {
    saveBill({ now: DEC_7 });

    expect(bills.list({ number: "NOPE", limit: 10, offset: 0 })).toEqual({ bills: [], total: 0 });
  });

  it("never returns more than the maximum page size", () => {
    const extraBills = MAX_BILL_PAGE_SIZE + 1;
    Array.from({ length: extraBills }).forEach(() => saveBill({ now: DEC_7 }));

    const listed = bills.list({ limit: extraBills + 100, offset: 0 });

    expect(listed.bills).toHaveLength(MAX_BILL_PAGE_SIZE);
    expect(listed.total).toBe(extraBills);
  });

  it.each([0, -1, -500, 0.5, 1.5, 500.5, NaN, Infinity, -Infinity])(
    "rejects invalid page limit %s before constructing a query",
    (limit) => {
      const select = vi.spyOn(testDb.db, "select");

      expect(() => bills.list({ limit, offset: 0 })).toThrowError(
        expect.objectContaining({
          code: "INVALID_FIELD",
          message: "Bill page limit must be a positive integer",
        }),
      );
      expect(select).not.toHaveBeenCalled();
    },
  );
});
