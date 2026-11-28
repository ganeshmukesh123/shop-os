import type { Item } from "@shopos/core";

export interface IBarcodeChooserProps {
  code: string;
  items: readonly Item[];
  onChoose: (item: Item) => void;
  onClose: () => void;
}
