import { checkInvariant, foldMovements, isNegative } from "../src/stock";

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
