import { BillRepository } from "../../src/main/repositories/BillRepository";
import { loadCtx } from "../../src/main/db/seed";
import {
  upgradeConnectionWithOneBill,
  upgradeDatabaseWithOneBill,
} from "../helpers/upgradeFixture";

/** Task T078, first half (migration 0010): number_series and the billed_at / business_date split. */
describe("upgrading numbering and bill times from migration 0004 (research D18, D22)", () => {
  it("turns the old counter into a series that keeps the next number and the shop's template", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const seriesRow = sqlite
      .prepare("select counter_code, financial_year, template, last_seq from number_series")
      .get();

    expect(seriesRow).toEqual({
      counter_code: "C1",
      financial_year: "26-27",
      template: "{series}/{fy}/{seq}",
      last_seq: 1,
    });
  });

  it("drops the old counter table", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const oldTable = sqlite
      .prepare("select name from sqlite_master where name = 'number_counter'")
      .get();

    expect(oldTable).toBeUndefined();
  });

  it("points the old bill at its series", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const linkRow = sqlite
      .prepare(
        "select number_series.counter_code, number_series.last_seq from bill join number_series on number_series.id = bill.number_series_id",
      )
      .get();

    expect(linkRow).toEqual({ counter_code: "C1", last_seq: 1 });
  });

  it("reads the old local time 15:00 on 15 Nov 2026 as 09:30 UTC, in the shop's zone (IST)", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const timeRow = sqlite.prepare("select billed_at, business_date from bill").get();

    expect(timeRow).toEqual({
      billed_at: Date.UTC(2026, 10, 15, 9, 30, 0),
      business_date: "2026-11-15",
    });
  });

  it("shows the upgraded bill with the same local time it was saved with", () => {
    const { sqlite, db } = upgradeConnectionWithOneBill();
    const billId = (sqlite.prepare("select id from bill").get() as { id: string }).id;

    const found = new BillRepository(db, loadCtx(db)).get(billId);

    expect(found?.bill.billDate).toBe("2026-11-15T15:00:00");
    expect(found?.bill.number).toBe("C1/26-27/000001");
  });

  it("keeps a healthy file and the bill's own protection", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(() => sqlite.prepare("delete from bill").run()).toThrow(/cannot be deleted/);
    expect(() => sqlite.prepare("update bill set business_date = '2020-01-01'").run()).toThrow(
      /can only be cancelled/,
    );
  });

  it("refuses a business date that is not YYYY-MM-DD", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    sqlite.pragma("foreign_keys = OFF");
    const insertBadDate = () =>
      sqlite
        .prepare(
          `insert into bill (id, business_id, shop_id, created_at, updated_at, device_id, counter_code, bill_no, financial_year, number_series_id, seq, billed_at, business_date, subtotal_paise, bill_discount_paise, total_paise, status)
           select 'bad-bill', business_id, shop_id, created_at, updated_at, device_id, counter_code, 'C1/X', financial_year, number_series_id, 99, billed_at, '15/11/2026', 0, 0, 0, 'posted' from bill`,
        )
        .run();

    expect(insertBadDate).toThrow(/bill_business_date_format/);
  });
});
