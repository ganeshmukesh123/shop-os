import type { Item } from "@shopos/core";

export interface IMergeDialogProps {
  /** The duplicate: it is merged away into the item the owner keeps */
  item: Item;
  onClose: () => void;
  onMerged: (survivor: Item) => void;
}
