import type { IFamily, ILikelyDuplicate } from "@shopos/core";

export interface INewFamilyButtonProps {
  onSaved: (family: IFamily) => void;
  /** The owner chose an existing item over a likely duplicate (T050) */
  onOpenExisting?: (duplicate: ILikelyDuplicate) => void;
}
