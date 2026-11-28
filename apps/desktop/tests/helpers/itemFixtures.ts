import type { IItemSearchRow, Item } from "@shopos/core";

/** Elbow 1 inch: sold below zero stock and then deactivated, so it needs a word for each state. */
export const NEGATIVE_INACTIVE_ITEM: Item = {
  id: "item-1",
  name: "Elbow 1 inch",
  unit: "pcs",
  allowsDecimal: false,
  pricePaise: 4500,
  stockMilli: -3000,
  active: false,
  needsCorrection: true,
};

/** PVC pipe: 10 pcs in stock at ₹120, active. Override only what a test is about. */
export function buildItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-pipe",
    name: "PVC pipe",
    unit: "pcs",
    allowsDecimal: false,
    pricePaise: 12_000,
    stockMilli: 10_000,
    active: true,
    needsCorrection: false,
    ...overrides,
  };
}

/** An item as a variant row of items.search (spec 002 T038), as the bill search receives it. */
export function searchRowOf(item: Item): IItemSearchRow {
  return {
    kind: "variant",
    id: item.id,
    displayName: item.name,
    matchedBy: "prefix",
    stockMilli: item.stockMilli,
    pricePaise: item.pricePaise,
    item,
  };
}
