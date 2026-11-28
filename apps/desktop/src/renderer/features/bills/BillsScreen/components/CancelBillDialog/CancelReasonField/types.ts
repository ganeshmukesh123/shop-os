export interface ICancelReasonFieldProps {
  reason: string;
  onChange: (nextReason: string) => void;
  /** True while the cancel is being saved. */
  isDisabled: boolean;
}
