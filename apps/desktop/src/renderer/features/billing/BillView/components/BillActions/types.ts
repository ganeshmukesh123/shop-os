import type { PrintTarget } from "@shopos/core";
import type { BillAction } from "../../useBillActions";

export interface IBillActionsProps {
  target: PrintTarget;
  onTargetChange: (target: PrintTarget) => void;
  /** The action running now (its button shows a spinner), or null. */
  busy: BillAction | null;
  onPrint: () => void;
  onPdf: () => void;
  /** "New bill" after saving, "Back to bills" when opened from the list. */
  leaveLabel: string;
  onLeave?: () => void;
  /** Present only when the bill may be cancelled; the button is hidden otherwise. */
  onCancel?: () => void;
}
