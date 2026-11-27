import { useState } from "react";
import type { Bill } from "@shopos/core";
import { call, messageOf } from "../../../../../../shared/api/api";
import type { ICancelBillState } from "./types";

/**
 * The cancel step of one bill: the reason being typed, whether the cancel is running, and why it
 * failed. A blank reason never reaches the main process (FR-017); it answers REASON_REQUIRED anyway.
 */
export function useCancelBill(
  billId: string,
  onCancelled: (cancelledBill: Bill) => void,
): ICancelBillState {
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function cancelBill() {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const { bill } = await call("bills.cancel", { id: billId, reason: reason.trim() });
      onCancelled(bill);
    } catch (caughtError) {
      setErrorMessage(messageOf(caughtError));
      setIsBusy(false);
    }
  }

  return { reason, setReason, isBusy, errorMessage, canCancel: reason.trim() !== "", cancelBill };
}
