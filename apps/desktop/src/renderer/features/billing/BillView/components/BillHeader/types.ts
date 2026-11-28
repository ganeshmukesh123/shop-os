import type { Bill, Item } from "@shopos/core";

export interface IBillHeaderProps {
  bill: Bill;
  /** Items this bill took below zero, named in a warning. */
  negativeStockItems: Item[];
  /** True when opened from the Bills screen ("Bill" heading), false right after saving. */
  isOpenedFromList: boolean;
}
