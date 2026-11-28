import type { IItemSearchRow, Item } from "@shopos/core";
import type { ITintedPick } from "../../hooks/useBillForm/types";

export interface IFamilyPickerProps {
  row: IItemSearchRow;
  customerName: string;
  onClose: () => void;
  onPickItem: (item: Item) => void;
  onPickTinted: (item: Item, pick: ITintedPick) => void;
}
