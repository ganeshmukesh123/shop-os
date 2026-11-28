export interface ICancelDialogButtonsProps {
  /** True while the cancel is being saved: both buttons wait. */
  isBusy: boolean;
  /** False while the reason is empty or only spaces. */
  canCancel: boolean;
  onConfirm: () => void;
}
