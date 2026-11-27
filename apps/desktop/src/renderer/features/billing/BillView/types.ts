import type { Bill, BillLine, Item } from "@shopos/core";

export interface IBillViewProps {
  bill: Bill;
  lines: BillLine[];
  negativeStockItems: Item[];
  /** Right after saving: the last button starts a new bill. */
  onNew?: () => void;
  /** Opened from the Bills screen: the last button goes back to the list. */
  onBack?: () => void;
  /** Offered as "Cancel bill" while the bill is posted; the Bills screen asks for the reason. */
  onCancel?: () => void;
}
