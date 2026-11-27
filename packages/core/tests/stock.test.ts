import { CoreError } from "../src/errors";
import {
  checkInvariant,
  foldMovements,
  isNegative,
  mergeMovementPair,
  movementLocations,
  signedQuantityMilli,
} from "../src/stock";

const mv = (itemId: string, quantityMilli: number) => ({ itemId, quantityMilli: quantityMilli });

describe("stock", () => {
  it("folds movements into stock per item", () => {
    const stockByItem = foldMovements([mv("a", 10000), mv("a", -2500), mv("b", 3000)]);
    expect(stockByItem.get("a")).toBe(7500);
    expect(stockByItem.get("b")).toBe(3000);
  });

  it("detects negative stock", () => {
    expect(isNegative(-1)).toBe(true);
    expect(isNegative(0)).toBe(false);
    const stockByItem = foldMovements([mv("a", 1000), mv("a", -3000)]);
    expect(isNegative(stockByItem.get("a")!)).toBe(true);
  });

  it("sale and sale_cancel cancel out exactly", () => {
    const stockByItem = foldMovements([mv("a", 5000), mv("a", -1234), mv("a", 1234)]);
    expect(stockByItem.get("a")).toBe(5000);
  });

  it("checks the cached-stock invariant", () => {
    const moves = [mv("a", 1000), mv("a", -400)];
    expect(checkInvariant(new Map([["a", 600]]), moves)).toEqual([]);
    expect(checkInvariant(new Map([["a", 700]]), moves)).toEqual([
      { itemId: "a", cached: 700, derived: 600 },
    ]);
    // item with a cached value but no movements: derived is 0
    expect(checkInvariant(new Map([["z", 5]]), [])).toEqual([
      { itemId: "z", cached: 5, derived: 0 },
    ]);
  });
});

describe("stock invariant edge cases", () => {
  it("reports an item that has movements but no cached stock", () => {
    const breaks = checkInvariant(new Map(), [mv("x", 500)]);
    expect(breaks).toEqual([{ itemId: "x", cached: 0, derived: 500 }]);
  });

  it("reports an item with cached stock but no movements", () => {
    const breaks = checkInvariant(new Map([["y", 700]]), []);
    expect(breaks).toEqual([{ itemId: "y", cached: 700, derived: 0 }]);
  });
});

const SHOP_FLOOR = "location-shop-floor";

function errorCodeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return error instanceof CoreError ? error.code : "NOT_A_CORE_ERROR";
  }
  return undefined;
}

describe("movement direction comes from the locations (data-model: stock_movement)", () => {
  it("stock in is a positive quantity with only a 'to' location", () => {
    expect(movementLocations(25500, SHOP_FLOOR)).toEqual({
      qtyBaseMilli: 25500,
      fromLocationId: null,
      toLocationId: SHOP_FLOOR,
    });
  });

  it("stock out is a positive quantity with only a 'from' location", () => {
    expect(movementLocations(-2000, SHOP_FLOOR)).toEqual({
      qtyBaseMilli: 2000,
      fromLocationId: SHOP_FLOOR,
      toLocationId: null,
    });
  });

  it("refuses a movement of zero, a fraction, or an unsafe number", () => {
    expect(errorCodeOf(() => movementLocations(0, SHOP_FLOOR))).toBe("INVALID_QUANTITY");
    expect(errorCodeOf(() => movementLocations(1.5, SHOP_FLOOR))).toBe("INVALID_QUANTITY");
    expect(errorCodeOf(() => movementLocations(Number.MAX_SAFE_INTEGER + 2, SHOP_FLOOR))).toBe(
      "INVALID_QUANTITY",
    );
  });

  it("reads the signed quantity back from the locations", () => {
    const stockIn = { qtyBaseMilli: 10000, fromLocationId: null, toLocationId: SHOP_FLOOR };
    const stockOut = { qtyBaseMilli: 2000, fromLocationId: SHOP_FLOOR, toLocationId: null };

    expect(signedQuantityMilli(stockIn)).toBe(10000);
    expect(signedQuantityMilli(stockOut)).toBe(-2000);
  });

  it("round-trips: a sale and its cancel add up to nothing", () => {
    const sale = movementLocations(-3000, SHOP_FLOOR);
    const saleCancel = movementLocations(3000, SHOP_FLOOR);

    expect(signedQuantityMilli(sale) + signedQuantityMilli(saleCancel)).toBe(0);
  });

  it("refuses a movement with both locations or neither (transfers come with feature 007)", () => {
    const transfer = { qtyBaseMilli: 100, fromLocationId: "a-rack", toLocationId: "b-rack" };
    const nowhere = { qtyBaseMilli: 100, fromLocationId: null, toLocationId: null };

    expect(errorCodeOf(() => signedQuantityMilli(transfer))).toBe("INVALID_FIELD");
    expect(errorCodeOf(() => signedQuantityMilli(nowhere))).toBe("INVALID_FIELD");
  });

  it("refuses a stored quantity that is not positive", () => {
    const zero = { qtyBaseMilli: 0, fromLocationId: null, toLocationId: SHOP_FLOOR };
    const negative = { qtyBaseMilli: -5, fromLocationId: null, toLocationId: SHOP_FLOOR };

    expect(errorCodeOf(() => signedQuantityMilli(zero))).toBe("INVALID_QUANTITY");
    expect(errorCodeOf(() => signedQuantityMilli(negative))).toBe("INVALID_QUANTITY");
  });
});

describe("merge movements (task T015, research D6 merge)", () => {
  it("moves a positive balance out of the merged-away variant and into the survivor", () => {
    const { source, target } = mergeMovementPair(4000, SHOP_FLOOR);

    expect(source).toEqual({
      reason: "merge_out",
      qtyBaseMilli: 4000,
      fromLocationId: SHOP_FLOOR,
      toLocationId: null,
    });
    expect(target).toEqual({
      reason: "merge_in",
      qtyBaseMilli: 4000,
      fromLocationId: null,
      toLocationId: SHOP_FLOOR,
    });
  });

  it("gives the survivor the stock: B with 4 merged into A with 10 leaves A 14 and B 0", () => {
    const { source, target } = mergeMovementPair(4000, SHOP_FLOOR);
    const movements = [
      mv("a", 10000),
      mv("b", 4000),
      mv("b", signedQuantityMilli(source)),
      mv("a", signedQuantityMilli(target)),
    ];

    const stockByItem = foldMovements(movements);

    expect(stockByItem.get("a")).toBe(14000);
    expect(stockByItem.get("b")).toBe(0);
  });

  it("moves negative stock the other way round: the survivor takes the shortfall", () => {
    const { source, target } = mergeMovementPair(-3000, SHOP_FLOOR);

    expect(source.reason).toBe("merge_in");
    expect(target.reason).toBe("merge_out");
    expect(signedQuantityMilli(source)).toBe(3000);
    expect(signedQuantityMilli(target)).toBe(-3000);
  });

  it("always adds up to nothing across the two variants", () => {
    const balances = [4000, -3000, 1, -1, 999999];

    const nets = balances.map((balance) => {
      const { source, target } = mergeMovementPair(balance, SHOP_FLOOR);
      return signedQuantityMilli(source) + signedQuantityMilli(target);
    });

    expect(nets).toEqual([0, 0, 0, 0, 0]);
  });

  it("makes no movement for a balance of zero or one that is not a whole number", () => {
    expect(errorCodeOf(() => mergeMovementPair(0, SHOP_FLOOR))).toBe("INVALID_QUANTITY");
    expect(errorCodeOf(() => mergeMovementPair(2.5, SHOP_FLOOR))).toBe("INVALID_QUANTITY");
  });
});
