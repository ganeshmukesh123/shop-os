import type { Bill, BillLine, Item } from "@shopos/core";

/** What the main process answers when a bill is saved. */
export interface ISavedBill {
  bill: Bill;
  lines: BillLine[];
  negativeStockItems: Item[];
}

export interface IBillSave {
  /** The bill that was just saved, until the cashier starts a new one. */
  saved: ISavedBill | null;
  isSaving: boolean;
  save: () => Promise<void>;
  startNewBill: () => void;
}
