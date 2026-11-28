import type { ILikelyDuplicate } from "@shopos/core";

export interface IDuplicateWarningProps {
  duplicates: readonly ILikelyDuplicate[];
  onSaveAnyway: () => void;
  /** Leave the form and show this item instead; no button when the caller cannot */
  onOpenExisting?: (duplicate: ILikelyDuplicate) => void;
}
