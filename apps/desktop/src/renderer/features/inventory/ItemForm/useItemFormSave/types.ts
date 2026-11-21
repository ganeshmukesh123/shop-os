import type { Item } from "@shopos/core";

export interface IItemFormSave {
  /** Plain sentences for the cashier: what to fix, or why the save failed. */
  errors: string[];
  /** Existing items with the same name; saving is blocked until the name is changed. */
  duplicateItems: Item[];
  isBusy: boolean;
  save: () => Promise<void>;
}
