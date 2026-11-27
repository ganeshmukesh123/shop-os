import { insertCatalogueRow, insertPipeVariant } from "../helpers/catalogueRows";
import { createTestDb } from "../helpers/testDb";
import { upgradeDatabaseWithOneBill } from "../helpers/upgradeFixture";

/**
 * Spec 002 T018 (migration 0018): unit_conversion, item_barcode, item_search_name, price_tier,
 * item_price, item_batch and item_sales_stat (data-model.md "Items").
 */
describe("unit_conversion (spec 002 T018)", () => {
  it("stores a roll of 90 m and refuses a second roll row or a zero factor", () => {
    const { sqlite } = createTestDb();
    const variantId = insertPipeVariant(sqlite);
    const conversion = (factorMilli: number) => () =>
      insertCatalogueRow(sqlite, "unit_conversion", {
        variant_id: variantId,
        uom_code: "roll",
        factor_milli: factorMilli,
      });

    expect(conversion(90_000)).not.toThrow();
    expect(conversion(45_000)).toThrow(/UNIQUE/);
    expect(() =>
      insertCatalogueRow(sqlite, "unit_conversion", {
        variant_id: variantId,
        uom_code: "box",
        factor_milli: 0,
      }),
    ).toThrow(/CHECK/);
  });

  it("refuses a unit the shop does not have", () => {
    const { sqlite } = createTestDb();
    const variantId = insertPipeVariant(sqlite);

    expect(() =>
      insertCatalogueRow(sqlite, "unit_conversion", {
        variant_id: variantId,
        uom_code: "furlong",
        factor_milli: 1000,
      }),
    ).toThrow(/FOREIGN KEY/);
  });
});

describe("item_barcode (spec 002 T018)", () => {
  it("lets two variants share a code (EC-07) but not one variant twice", () => {
    const { sqlite } = createTestDb();
    const firstVariant = insertPipeVariant(sqlite);
    const secondVariant = insertPipeVariant(sqlite);
    const barcode = (variantId: string) => () =>
      insertCatalogueRow(sqlite, "item_barcode", {
        variant_id: variantId,
        code: "8901234567890",
        source: "manufacturer",
      });

    expect(barcode(firstVariant)).not.toThrow();
    expect(barcode(secondVariant)).not.toThrow();
    expect(barcode(firstVariant)).toThrow(/UNIQUE/);
  });

  it("refuses spaces, an empty code, 49 characters and an unknown source", () => {
    const { sqlite } = createTestDb();
    const variantId = insertPipeVariant(sqlite);
    const barcode =
      (code: string, source = "shop_label") =>
      () =>
        insertCatalogueRow(sqlite, "item_barcode", { variant_id: variantId, code, source });

    expect(barcode("SHOP-0001")).not.toThrow();
    expect(barcode("890 123")).toThrow(/CHECK/);
    expect(barcode("")).toThrow(/CHECK/);
    expect(barcode("9".repeat(49))).toThrow(/CHECK/);
    expect(barcode("8901", "supplier")).toThrow(/CHECK/);
  });
});

describe("item_search_name (spec 002 T018)", () => {
  it("refuses the same name twice on one variant, ignoring case", () => {
    const { sqlite } = createTestDb();
    const variantId = insertPipeVariant(sqlite);
    const searchName = (name: string) => () =>
      insertCatalogueRow(sqlite, "item_search_name", {
        variant_id: variantId,
        name,
        language: "hinglish",
        kind: "alias",
      });

    expect(searchName("nali")).not.toThrow();
    expect(searchName("NALI")).toThrow(/UNIQUE/);
    expect(searchName(" nali")).toThrow(/CHECK/);
  });

  it("refuses an unknown language or kind", () => {
    const { sqlite } = createTestDb();
    const variantId = insertPipeVariant(sqlite);

    expect(() =>
      insertCatalogueRow(sqlite, "item_search_name", {
        variant_id: variantId,
        name: "paip",
        language: "fr",
        kind: "alias",
      }),
    ).toThrow(/CHECK/);
    expect(() =>
      insertCatalogueRow(sqlite, "item_search_name", {
        variant_id: variantId,
        name: "paip",
        language: "hi",
        kind: "nickname",
      }),
    ).toThrow(/CHECK/);
  });
});

describe("price tiers (spec 002 T018)", () => {
  it("seeds Retail as the only default, with Contractor and Dealer, on a new and an upgraded shop", () => {
    const tiers = (sqlite: ReturnType<typeof upgradeDatabaseWithOneBill>) =>
      sqlite.prepare("select code, label, is_default from price_tier order by code").all();
    const expected = [
      { code: "contractor", label: "Contractor", is_default: 0 },
      { code: "dealer", label: "Dealer", is_default: 0 },
      { code: "retail", label: "Retail", is_default: 1 },
    ];

    expect(tiers(createTestDb().sqlite)).toEqual(expected);
    expect(tiers(upgradeDatabaseWithOneBill())).toEqual(expected);
  });

  it("holds one price per variant and tier, never negative", () => {
    const { sqlite } = createTestDb();
    const variantId = insertPipeVariant(sqlite);
    const dealerTier = (
      sqlite.prepare("select id from price_tier where code = 'dealer'").get() as { id: string }
    ).id;
    const price = (pricePaise: number) => () =>
      insertCatalogueRow(sqlite, "item_price", {
        variant_id: variantId,
        tier_id: dealerTier,
        price_paise: pricePaise,
      });

    expect(price(10_500)).not.toThrow();
    expect(price(10_000)).toThrow(/UNIQUE/);
    expect(() => {
      sqlite.prepare("delete from item_price").run();
      price(-1)();
    }).toThrow(/CHECK/);
  });
});

describe("item_batch and item_sales_stat (spec 002 T018)", () => {
  it("refuses a batch with no MRP above zero or a batch code over 30 characters", () => {
    const { sqlite } = createTestDb();
    const variantId = insertPipeVariant(sqlite);
    const batch = (columns: Record<string, unknown>) => () =>
      insertCatalogueRow(sqlite, "item_batch", {
        variant_id: variantId,
        mrp_paise: 15_000,
        received_at: 1,
        ...columns,
      });

    expect(batch({ batch_code: "B-2026-11" })).not.toThrow();
    expect(batch({ mrp_paise: 0 })).toThrow(/CHECK/);
    expect(batch({ batch_code: "B".repeat(31) })).toThrow(/CHECK/);
  });

  it("keeps one sales-stat row per variant", () => {
    const { sqlite } = createTestDb();
    const variantId = insertPipeVariant(sqlite);
    const salesStat = () =>
      insertCatalogueRow(sqlite, "item_sales_stat", { variant_id: variantId });

    expect(salesStat).not.toThrow();
    expect(salesStat).toThrow(/UNIQUE/);
    expect(
      sqlite
        .prepare("select sold_qty_90d_milli, bill_count_90d, last_sold_at from item_sales_stat")
        .get(),
    ).toEqual({ sold_qty_90d_milli: 0, bill_count_90d: 0, last_sold_at: null });
  });
});

describe("the 001 barcode after the upgrade (spec 002 T018)", () => {
  it("copies a variant's old barcode into item_barcode as a manufacturer code", () => {
    const sqlite = upgradeDatabaseWithOneBill({
      beforeUpgrade: (oldDatabase) =>
        oldDatabase.prepare("update item set barcode = '8901234567890'").run(),
    });

    const barcodes = sqlite.prepare("select variant_id, code, source from item_barcode").all();
    const variantId = (sqlite.prepare("select id from item_variant").get() as { id: string }).id;

    expect(barcodes).toEqual([
      { variant_id: variantId, code: "8901234567890", source: "manufacturer" },
    ]);
  });

  it("upgrades without copying an old barcode the new rules refuse", () => {
    const sqlite = upgradeDatabaseWithOneBill({
      beforeUpgrade: (oldDatabase) =>
        oldDatabase.prepare("update item set barcode = '890 123'").run(),
    });

    expect(sqlite.prepare("select count(*) as barcodes from item_barcode").get()).toEqual({
      barcodes: 0,
    });
    expect(sqlite.prepare("select barcode from item_variant").get()).toEqual({
      barcode: "890 123",
    });
  });

  it("adds no barcode row for an item that had none", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(sqlite.prepare("select count(*) as barcodes from item_barcode").get()).toEqual({
      barcodes: 0,
    });
  });
});
