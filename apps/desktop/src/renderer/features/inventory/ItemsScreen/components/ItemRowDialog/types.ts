import type { Item } from "@shopos/core";

export interface IItemRowDialog {
  kind: "units" | "merge" | "names";
  item: Item;
}

export interface IItemRowDialogProps {
  dialog: IItemRowDialog;
  onClose: () => void;
  onMerged: (survivor: Item) => void;
}
