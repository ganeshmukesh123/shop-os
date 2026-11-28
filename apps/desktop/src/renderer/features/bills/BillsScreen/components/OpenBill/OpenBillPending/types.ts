export interface IOpenBillPendingProps {
  /** Why the bill could not be opened, or null while it is still loading. */
  error: string | null;
  onBack: () => void;
}
