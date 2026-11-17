import { insertTargetSeriesAndBill } from "../helpers/schemaRows";
import { createTestDb } from "../helpers/testDb";
import { upgradeDatabaseWithOneBill } from "../helpers/upgradeFixture";

/** Task T080 (migration 0013): round-off and document title on the bill, three new shop settings. */
describe("upgrading a database for round-off, document title and time zone (FR-010a, FR-015a, FR-019a)", () => {
  it("keeps the old bill and gives it a round-off of 0 and the title 'Estimate'", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const billRow = sqlite
      .prepare("select bill_no, round_off_paise, doc_title, total_paise from bill")
      .get();

    expect(billRow).toEqual({
      bill_no: "C1/26-27/000001",
      round_off_paise: 0,
      doc_title: "Estimate",
      total_paise: 24000,
    });
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  });

  it("keeps the shop profile and gives it rounding on, Asia/Kolkata and the title 'Estimate'", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const profileRow = sqlite
      .prepare(
        "select name, receipt_width, doc_title, round_bill_total, time_zone from shop_profile",
      )
      .get();

    expect(profileRow).toEqual({
      name: "My Shop",
      receipt_width: "80mm",
      doc_title: "Estimate",
      round_bill_total: 1,
      time_zone: "Asia/Kolkata",
    });
  });

  it("keeps the bill's lines, tender and number series attached", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const attached = sqlite
      .prepare(
        `select (select count(*) from bill_line) as lines, (select count(*) from bill_tender) as tenders,
                (select count(*) from number_series) as series`,
      )
      .get();

    expect(attached).toEqual({ lines: 1, tenders: 1, series: 1 });
  });

  it("still refuses to delete a bill, to edit its title or round-off, and lets it be cancelled", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(() => sqlite.prepare("delete from bill").run()).toThrow(/cannot be deleted/);
    expect(() => sqlite.prepare("update bill set doc_title = 'Cash Memo'").run()).toThrow(
      /can only be cancelled/,
    );
    expect(() => sqlite.prepare("update bill set round_off_paise = 10").run()).toThrow(
      /can only be cancelled/,
    );
    sqlite
      .prepare(
        "update bill set status = 'cancelled', cancel_reason = 'wrong item', cancelled_at = 1",
      )
      .run();
    expect(sqlite.prepare("select status from bill").get()).toEqual({ status: "cancelled" });
  });
});

describe("the bill's round-off rules in the database", () => {
  it("accepts a total that equals subtotal - discount + round-off", () => {
    const testDb = createTestDb();

    insertTargetSeriesAndBill(testDb.sqlite, testDb.ctx, undefined, {
      subtotal_paise: 84960 - 0,
      total_paise: 85000,
      round_off_paise: 40,
    });

    expect(testDb.sqlite.prepare("select total_paise, round_off_paise from bill").get()).toEqual({
      total_paise: 85000,
      round_off_paise: 40,
    });
  });

  it("refuses a total that does not add up with its round-off", () => {
    const testDb = createTestDb();

    const insertWrongTotal = () =>
      insertTargetSeriesAndBill(testDb.sqlite, testDb.ctx, undefined, {
        total_paise: 24000,
        round_off_paise: 40,
      });

    expect(insertWrongTotal).toThrow(/bill_total_eq|CHECK/);
  });

  it("refuses a round-off of more than 50 paise either way", () => {
    const testDb = createTestDb();

    const insertBigRoundOff = () =>
      insertTargetSeriesAndBill(testDb.sqlite, testDb.ctx, undefined, {
        total_paise: 24051,
        round_off_paise: 51,
      });

    expect(insertBigRoundOff).toThrow(/bill_round_off_range|CHECK/);
  });

  it("refuses an empty document title", () => {
    const testDb = createTestDb();

    const insertBlankTitle = () =>
      insertTargetSeriesAndBill(testDb.sqlite, testDb.ctx, undefined, { doc_title: "   " });

    expect(insertBlankTitle).toThrow(/bill_doc_title_len|CHECK/);
  });
});

describe("the shop profile's new settings in the database", () => {
  it("accepts a4 and a5 as the receipt width, and refuses anything else", () => {
    const testDb = createTestDb();

    testDb.sqlite.prepare("update shop_profile set receipt_width = 'a4'").run();
    testDb.sqlite.prepare("update shop_profile set receipt_width = 'a5'").run();
    const setUnknownWidth = () =>
      testDb.sqlite.prepare("update shop_profile set receipt_width = 'a3'").run();

    expect(setUnknownWidth).toThrow(/shop_profile_width|CHECK/);
  });

  it("starts a new shop with rounding on, the title 'Estimate' and Asia/Kolkata", () => {
    const testDb = createTestDb();

    const profileRow = testDb.sqlite
      .prepare("select doc_title, round_bill_total, time_zone from shop_profile")
      .get();

    expect(profileRow).toEqual({
      doc_title: "Estimate",
      round_bill_total: 1,
      time_zone: "Asia/Kolkata",
    });
  });

  it("refuses a rounding switch that is not 0 or 1", () => {
    const testDb = createTestDb();

    const setBadSwitch = () =>
      testDb.sqlite.prepare("update shop_profile set round_bill_total = 2").run();

    expect(setBadSwitch).toThrow(/shop_profile_round_bool|CHECK/);
  });
});
