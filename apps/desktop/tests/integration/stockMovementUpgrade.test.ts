import { upgradeDatabaseWithOneBill } from "../helpers/upgradeFixture";
import { createTestDb } from "../helpers/testDb";

const INSERT_MOVEMENT = `insert into stock_movement
  (id, business_id, shop_id, created_at, updated_at, variant_id, movement_type, qty_base_milli,
   from_location_id, to_location_id, doc_type, doc_id, note, occurred_at, device_id)
  values (@id, @businessId, @shopId, 'now', 'now', @variantId, @movementType, @qty,
   @fromLocationId, @toLocationId, @docType, @docId, @note, 'now', 'device-1')`;

/** Task T075 (migration 0007): movements keep a positive quantity and a direction from locations. */
describe("upgrading stock movements from migration 0004 (research D18)", () => {
  it("seeds one 'Shop floor' location for the existing shop", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const locationRows = sqlite.prepare("select name, kind from location").all();

    expect(locationRows).toEqual([{ name: "Shop floor", kind: "shop_floor" }]);
  });

  it("turns the opening +10 pcs into stock arriving on the shop floor", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const openingRow = sqlite
      .prepare(
        "select qty_base_milli, from_location_id, to_location_id is not null as arrives, doc_type from stock_movement where movement_type = 'opening'",
      )
      .get();

    expect(openingRow).toEqual({
      qty_base_milli: 10000,
      from_location_id: null,
      arrives: 1,
      doc_type: null,
    });
  });

  it("turns the sale of 2 pcs into stock leaving the shop floor, tied to its bill", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const saleRow = sqlite
      .prepare(
        "select qty_base_milli, from_location_id is not null as leaves, to_location_id, doc_type, doc_id from stock_movement where movement_type = 'sale'",
      )
      .get();

    expect(saleRow).toEqual({
      qty_base_milli: 2000,
      leaves: 1,
      to_location_id: null,
      doc_type: "bill",
      doc_id: "bill-1",
    });
  });

  it("keeps the stock invariant: the movements still add up to the item's stock", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const sums = sqlite
      .prepare(
        `select (select stock_milli from item_variant) as cached,
         (select sum(case when to_location_id is not null then qty_base_milli else -qty_base_milli end) from stock_movement) as derived`,
      )
      .get();

    expect(sums).toEqual({ cached: 8000, derived: 8000 });
  });

  it("leaves no broken reference and keeps the append-only triggers", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(() => sqlite.prepare("delete from stock_movement").run()).toThrow(/append-only/);
  });
});

const SHOP_FLOOR_LOCATION = "shop-floor-location";

describe("stock_movement rules in the database", () => {
  function insertMovement(overrides: Record<string, string | number | null>): void {
    const { sqlite, ctx } = createTestDb();
    sqlite
      .prepare(
        "insert into item_family (id, business_id, shop_id, created_at, updated_at, name) values ('family-1', ?, ?, 'now', 'now', 'Pipe')",
      )
      .run(ctx.businessId, ctx.shopId);
    sqlite
      .prepare(
        `insert into item_variant (id, business_id, shop_id, created_at, updated_at, family_id, item_code, display_name, base_uom, selling_price_paise)
         values ('variant-1', ?, ?, 'now', 'now', 'family-1', 'ITM-0001', 'Pipe', 'pcs', 100)`,
      )
      .run(ctx.businessId, ctx.shopId);
    const shopFloor = sqlite.prepare("select id from location").get() as { id: string };
    sqlite.prepare(INSERT_MOVEMENT).run({
      id: "movement-1",
      businessId: ctx.businessId,
      shopId: ctx.shopId,
      variantId: "variant-1",
      movementType: "opening",
      qty: 1000,
      fromLocationId: null,
      toLocationId: shopFloor.id,
      docType: null,
      docId: null,
      note: null,
      ...overrides,
      ...resolveShopFloor(overrides, shopFloor.id),
    });
  }

  /** Lets a test point an endpoint at the real shop floor location without knowing its id. */
  function resolveShopFloor(
    overrides: Record<string, string | number | null>,
    shopFloorId: string,
  ): Record<string, string> {
    const entries = Object.entries(overrides).filter(([, value]) => value === SHOP_FLOOR_LOCATION);
    return Object.fromEntries(entries.map(([column]) => [column, shopFloorId]));
  }

  it("accepts stock in with only a 'to' location", () => {
    expect(() => insertMovement({})).not.toThrow();
  });

  it("refuses a movement with both locations, or none", () => {
    expect(() => insertMovement({ fromLocationId: SHOP_FLOOR_LOCATION })).toThrow(
      /stock_movement_one_direction/,
    );
    expect(() => insertMovement({ toLocationId: null })).toThrow(/stock_movement_one_direction/);
  });

  it("refuses a quantity of zero or below", () => {
    expect(() => insertMovement({ qty: 0 })).toThrow(/stock_movement_qty_pos/);
    expect(() => insertMovement({ qty: -5 })).toThrow(/stock_movement_qty_pos/);
  });

  it("refuses an adjustment without a note", () => {
    expect(() => insertMovement({ movementType: "adjustment" })).toThrow(
      /stock_movement_adjustment_note/,
    );
    expect(() => insertMovement({ movementType: "adjustment", note: "   " })).toThrow(
      /stock_movement_adjustment_note/,
    );
  });

  it("refuses a document type without a document id", () => {
    expect(() => insertMovement({ docType: "bill" })).toThrow(/stock_movement_doc_pair/);
  });
});
