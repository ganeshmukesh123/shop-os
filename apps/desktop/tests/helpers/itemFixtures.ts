import type { Item } from "@shopos/core";

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
