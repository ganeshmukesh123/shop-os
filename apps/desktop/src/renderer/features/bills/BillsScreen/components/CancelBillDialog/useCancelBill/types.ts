export interface ICancelBillState {
  reason: string;
  setReason: (nextReason: string) => void;
  isBusy: boolean;
  /** Why the cancel failed, or null. The dialog stays open so the reason is not lost. */
  errorMessage: string | null;
  /** False while the reason is empty or only spaces. */
  canCancel: boolean;
  cancelBill: () => Promise<void>;
}
