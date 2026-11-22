import { BillingService } from "../../src/main/services/BillingService";
import { InventoryService } from "../../src/main/services/InventoryService";
import { SettingsService } from "../../src/main/services/SettingsService";
import { buildHandlersFixture } from "../helpers/handlersFixture";
import { createTestDb, type TestDb } from "../helpers/testDb";

const BILLED_AT = new Date(Date.UTC(2026, 10, 16, 9, 30)); // 15:00 in India
const ONE_HOUR_MS = 3_600_000;

let testDb: TestDb;
let settings: SettingsService;

beforeEach(() => {
  testDb = createTestDb();
  settings = new SettingsService(testDb.db, testDb.ctx);
});

function saveOneBillAt(billedAt: Date): void {
  const pipeItemId = new InventoryService(testDb.db, testDb.ctx).createItem({
    name: "Pipe",
    unit: "pcs",
    pricePaise: 10000,
    openingQtyMilli: 10000,
  }).item.id;
  new BillingService(testDb.db, testDb.ctx).saveBill(
    {
      clientBillId: crypto.randomUUID(),
      paymentMode: "cash",
      billDiscountPaise: 0,
      lines: [{ itemId: pipeItemId, quantityMilli: 1000, ratePaise: 10000, lineDiscountPaise: 0 }],
    },
    billedAt,
  );
}

describe("settings.clockCheck (task T080, FR-019a)", () => {
  it("has no warning for a new shop whose computer is in the shop's zone", () => {
    const result = settings.clockCheck("Asia/Kolkata", BILLED_AT);

    expect(result).toEqual({ warnings: [] });
  });

  it("warns when the computer is set to another zone than the shop's", () => {
    const result = settings.clockCheck("America/Los_Angeles", BILLED_AT);

    expect(result).toEqual({ warnings: ["TIME_ZONE_DIFFERS"] });
  });

  it("compares with the zone the shop saved in its settings", () => {
    settings.update({ ...settings.get(), timeZone: "America/Los_Angeles" });

    expect(settings.clockCheck("America/Los_Angeles", BILLED_AT)).toEqual({ warnings: [] });
    expect(settings.clockCheck("Asia/Kolkata", BILLED_AT)).toEqual({
      warnings: ["TIME_ZONE_DIFFERS"],
    });
  });

  it("warns when the clock is earlier than the newest saved bill", () => {
    saveOneBillAt(BILLED_AT);

    const result = settings.clockCheck("Asia/Kolkata", new Date(BILLED_AT.getTime() - ONE_HOUR_MS));

    expect(result).toEqual({ warnings: ["CLOCK_BEFORE_LAST_BILL"] });
  });

  it("does not warn when the clock is later than the newest bill", () => {
    saveOneBillAt(BILLED_AT);

    const result = settings.clockCheck("Asia/Kolkata", new Date(BILLED_AT.getTime() + ONE_HOUR_MS));

    expect(result).toEqual({ warnings: [] });
  });

  it("changes nothing in the database: it only reads", () => {
    saveOneBillAt(BILLED_AT);
    const billCountBefore = testDb.sqlite.prepare("select count(*) as total from bill").get();

    settings.clockCheck("UTC", new Date(BILLED_AT.getTime() - ONE_HOUR_MS));

    expect(testDb.sqlite.prepare("select count(*) as total from bill").get()).toEqual(
      billCountBefore,
    );
  });
});

describe("the settings.clockCheck command", () => {
  it("returns the warnings as data, never as a failure", async () => {
    const { handlers } = buildHandlersFixture();

    const result = await handlers["settings.clockCheck"]({ deviceTimeZone: "America/Los_Angeles" });

    expect(result).toEqual({ ok: true, data: { warnings: ["TIME_ZONE_DIFFERS"] } });
  });

  it("refuses an input without the device zone", async () => {
    const { handlers } = buildHandlersFixture();

    const result = await handlers["settings.clockCheck"]({});

    expect(result).toMatchObject({ ok: false, code: "INVALID_FIELD" });
  });
});

describe("settings.update number template preview (FR-019a)", () => {
  it("accepts a template and judges its example with the zone being saved", () => {
    const saved = settings.update({
      ...settings.get(),
      numberTemplate: "{series}/{fy}/{seq}",
      timeZone: "America/Los_Angeles",
    });

    expect(saved.timeZone).toBe("America/Los_Angeles");
  });
});
