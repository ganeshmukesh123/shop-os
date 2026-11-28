import type { Item } from "@shopos/core";

export interface IVariantGridProps {
  familyId: string;
  /** The family's name, for the dialog title */
  title: string;
  onPick: (item: Item) => void;
  onClose: () => void;
}
