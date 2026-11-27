import type { Bill } from "@shopos/core";

export interface ICancelBillDialogProps {
  /** The bill to cancel; its number is named in the dialog. */
  bill: Bill;
  /** The owner chose to keep the bill. */
  onClose: () => void;
  /** The bill is cancelled; called with the saved bill as the main process returned it. */
  onCancelled: (cancelledBill: Bill) => void;
}
