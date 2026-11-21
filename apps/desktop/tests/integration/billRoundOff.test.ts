import { BillRepository } from "../../src/main/repositories/BillRepository";
import { BillingService } from "../../src/main/services/BillingService";
import { InventoryService } from "../../src/main/services/InventoryService";
import { SettingsService } from "../../src/main/services/SettingsService";
import { createTestDb, type TestDb } from "../helpers/testDb";

const WORKING_DAY = new Date(Date.UTC(2026, 11, 7, 10, 0));
// 00:10 IST on 1 April 2027 is 18:40 UTC on 31 March: still 31 March in Los Angeles.
const JUST_AFTER_MIDNIGHT_IN_INDIA = new Date(Date.UTC(2027, 2, 31, 18, 40));

let testDb: TestDb;
let billing: BillingService;
let settings: SettingsService;
let pipeItemId: string;

beforeEach(() => {
  testDb = createTestDb();
  billing = new BillingService(testDb.db, testDb.ctx);
  settings = new SettingsService(testDb.db, testDb.ctx);
  pipeItemId = new InventoryService(testDb.db, testDb.ctx).createItem({
    name: "Pipe",
    unit: "pcs",
    pricePaise: 10000,
    openingQtyMilli: 100000,
  }).item.id;
});

const saveBillOf = (
  totalPaise: number,
  extra: { billDiscountPaise?: number } = {},
  now = WORKING_DAY,
) =>
  billing.saveBill(
    {
      clientBillId: crypto.randomUUID(),
      paymentMode: "cash",
      billDiscountPaise: extra.billDiscountPaise ?? 0,
      lines: [
        { itemId: pipeItemId, quantityMilli: 1000, ratePaise: totalPaise, lineDiscountPaise: 0 },
      ],
    },
    now,
  );

const changeSettings = (changes: {
  roundBillTotal?: boolean;
  docTitle?: string;
  timeZone?: string;
}) => settings.update({ ...settings.get(), ...changes });

describe("saving a bill rounds the grand total (FR-010a, research D20)", () => {
  it("rounds 849.60 up to 850.00 and stores a round-off of +0.40", () => {
    const saveResult = saveBillOf(84960);

    expect(saveResult.bill.linesTotalPaise).toBe(84960);
    expect(saveResult.bill.roundOffPaise).toBe(40);
    expect(saveResult.bill.grandTotalPaise).toBe(85000);
  });

  it("rounds 849.49 down to 849.00 and stores a round-off of -0.49", () => {
    const saveResult = saveBillOf(84949);

    expect(saveResult.bill.roundOffPaise).toBe(-49);
    expect(saveResult.bill.grandTotalPaise).toBe(84900);
  });

  it("rounds 849.50 up to 850.00 (50 paise and above rounds up)", () => {
    const saveResult = saveBillOf(84950);

    expect(saveResult.bill.roundOffPaise).toBe(50);
    expect(saveResult.bill.grandTotalPaise).toBe(85000);
  });

  it("leaves a whole-rupee total alone, with a round-off of 0", () => {
    const saveResult = saveBillOf(85000);

    expect(saveResult.bill.roundOffPaise).toBe(0);
    expect(saveResult.bill.grandTotalPaise).toBe(85000);
  });

  it("rounds after the bill discount: 1000.00 less 150.40 is 849.60, so 850.00", () => {
    const saveResult = saveBillOf(100000, { billDiscountPaise: 15040 });

    expect(saveResult.bill.billDiscountPaise).toBe(15040);
    expect(saveResult.bill.roundOffPaise).toBe(40);
    expect(saveResult.bill.grandTotalPaise).toBe(85000);
  });

  it("keeps exact paise and a round-off of 0 when the shop turns rounding off", () => {
    changeSettings({ roundBillTotal: false });

    const saveResult = saveBillOf(84960);

    expect(saveResult.bill.roundOffPaise).toBe(0);
    expect(saveResult.bill.grandTotalPaise).toBe(84960);
  });

  it("stores the round-off and the rounded total, and records the tender for the rounded total", () => {
    const saveResult = saveBillOf(84960);

    const billRow = testDb.sqlite
      .prepare("select subtotal_paise, round_off_paise, total_paise from bill")
      .get();
    const tenderRow = testDb.sqlite.prepare("select amount_paise from bill_tender").get();

    expect(billRow).toEqual({ subtotal_paise: 84960, round_off_paise: 40, total_paise: 85000 });
    expect(tenderRow).toEqual({ amount_paise: 85000 });
    expect(saveResult.bill.grandTotalPaise).toBe(85000);
  });
});

describe("saving a bill stores the document title (FR-015a, research D23)", () => {
  it("prints 'Estimate' by default", () => {
    expect(saveBillOf(10000).bill.docTitle).toBe("Estimate");
  });

  it("keeps the title the bill was saved with when the shop changes it later", () => {
    const firstBill = saveBillOf(10000).bill;

    changeSettings({ docTitle: "Cash Memo" });
    const secondBill = saveBillOf(10000).bill;

    const reloadedFirstBill = new BillRepository(testDb.db, testDb.ctx).get(firstBill.id)!.bill;
    expect(reloadedFirstBill.docTitle).toBe("Estimate");
    expect(secondBill.docTitle).toBe("Cash Memo");
  });
});

describe("saving a bill uses the shop's time zone setting (FR-019a, research D22)", () => {
  it("puts 00:10 IST on 1 April in financial year 27-28 with the default zone", () => {
    const saveResult = saveBillOf(10000, {}, JUST_AFTER_MIDNIGHT_IN_INDIA);

    expect(saveResult.bill.number).toBe("C1/27-28/000001");
  });

  it("puts the same instant in 26-27 when the shop's zone is Los Angeles", () => {
    changeSettings({ timeZone: "America/Los_Angeles" });

    const saveResult = saveBillOf(10000, {}, JUST_AFTER_MIDNIGHT_IN_INDIA);

    const businessDateRow = testDb.sqlite.prepare("select business_date from bill").get();
    expect(saveResult.bill.number).toBe("C1/26-27/000001");
    expect(businessDateRow).toEqual({ business_date: "2027-03-31" });
  });

  it("shows the stored bill time in the shop's zone", () => {
    changeSettings({ timeZone: "America/Los_Angeles" });

    const saveResult = saveBillOf(10000, {}, JUST_AFTER_MIDNIGHT_IN_INDIA);

    expect(saveResult.bill.billDate).toBe("2027-03-31T11:40:00");
  });
});
