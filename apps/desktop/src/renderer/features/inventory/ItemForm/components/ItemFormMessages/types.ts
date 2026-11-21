import type { Item } from "@shopos/core";

export interface IItemFormMessagesProps {
  /** What to fix, or why the save failed: one message each. */
  errors: string[];
  /** Existing items with the same name. */
  duplicateItems: Item[];
}
