import type Database from "better-sqlite3";
import { upgradeDatabaseWithOneBill } from "../helpers/upgradeFixture";

/** Task T083 (migration 0014): the table that records the bill numbers a restore lost (research D21). */
describe("upgrading a database for the bill-number gap table (FR-013b, EC-19)", () => {
  const EPOCH_MS = 1_794_600_000_000;

  /** One gap row for the upgraded shop's only number series; `overrides` change single columns. */
  function insertGap(sqlite: Database.Database, overrides: Record<string, string | number> = {}) {
    const shopRow = sqlite.prepare("select business_id, shop_id from shop_profile").get() as {
      business_id: string;
      shop_id: string;
    };
    const seriesRow = sqlite.prepare("select id from number_series").get() as { id: string };
    const row = {
      id: "gap-1",
      business_id: shopRow.business_id,
      shop_id: shopRow.shop_id,
      created_at: EPOCH_MS,
      updated_at: EPOCH_MS,
      number_series_id: seriesRow.id,
      seq_from: 121,
      seq_to: 126,
      reason: "lost_in_restore",
      is_estimated: 0,
      recorded_at: EPOCH_MS,
      ...overrides,
    };
    sqlite
      .prepare(
        `insert into bill_number_gap (id, business_id, shop_id, created_at, updated_at,
           number_series_id, seq_from, seq_to, reason, is_estimated, recorded_at)
         values (@id, @business_id, @shop_id, @created_at, @updated_at,
           @number_series_id, @seq_from, @seq_to, @reason, @is_estimated, @recorded_at)`,
      )
      .run(row);
  }

  it("adds an empty table and keeps the old bill and its series", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const counts = sqlite
      .prepare(
        `select (select count(*) from bill_number_gap) as gaps, (select count(*) from bill) as bills,
                (select last_seq from number_series) as lastSeq`,
      )
      .get();

    expect(counts).toEqual({ gaps: 0, bills: 1, lastSeq: 1 });
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  });

  it("records a lost range for a series, with the reason 'lost_in_restore'", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    insertGap(sqlite);

    expect(sqlite.prepare("select seq_from, seq_to, reason from bill_number_gap").get()).toEqual({
      seq_from: 121,
      seq_to: 126,
      reason: "lost_in_restore",
    });
  });

  it("records whether the range was confirmed by the owner or is the guessed block of 100", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    insertGap(sqlite, { id: "gap-confirmed", seq_from: 121, seq_to: 126, is_estimated: 0 });
    insertGap(sqlite, { id: "gap-guessed", seq_from: 127, seq_to: 226, is_estimated: 1 });

    expect(
      sqlite.prepare("select id, is_estimated from bill_number_gap order by seq_from").all(),
    ).toEqual([
      { id: "gap-confirmed", is_estimated: 0 },
      { id: "gap-guessed", is_estimated: 1 },
    ]);
  });

  it("refuses a gap that does not say whether it was guessed", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(() => insertGap(sqlite, { is_estimated: 2 })).toThrow(/CHECK|constraint/i);
    expect(() =>
      sqlite
        .prepare(
          `insert into bill_number_gap (id, business_id, shop_id, created_at, updated_at,
             number_series_id, seq_from, seq_to, reason, recorded_at)
           select 'gap-x', business_id, shop_id, 1, 1, (select id from number_series), 1, 1,
             'lost_in_restore', 1 from shop_profile`,
        )
        .run(),
    ).toThrow(/NOT NULL/i);
  });

  it("accepts a range of one number", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    insertGap(sqlite, { seq_from: 127, seq_to: 127 });

    expect(sqlite.prepare("select count(*) as total from bill_number_gap").get()).toEqual({
      total: 1,
    });
  });

  it("refuses a range that ends before it starts, or starts below 1", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(() => insertGap(sqlite, { seq_from: 126, seq_to: 121 })).toThrow(/CHECK|constraint/i);
    expect(() => insertGap(sqlite, { seq_from: 0, seq_to: 5 })).toThrow(/CHECK|constraint/i);
  });

  it("refuses a reason other than 'lost_in_restore'", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(() => insertGap(sqlite, { reason: "cancelled" })).toThrow(/CHECK|constraint/i);
  });

  it("refuses a gap for a series that does not exist", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(() => insertGap(sqlite, { number_series_id: "no-such-series" })).toThrow(/FOREIGN KEY/i);
  });

  it("is append-only: a recorded gap cannot be changed or deleted", () => {
    const sqlite = upgradeDatabaseWithOneBill();
    insertGap(sqlite);

    expect(() => sqlite.prepare("update bill_number_gap set seq_to = 999").run()).toThrow(
      /append-only/,
    );
    expect(() => sqlite.prepare("delete from bill_number_gap").run()).toThrow(/append-only/);
    expect(sqlite.prepare("select seq_to from bill_number_gap").get()).toEqual({ seq_to: 126 });
  });
});
