import type { IItemSearchRow, Item } from "@shopos/core";
import type { ITintedPick } from "../../hooks/useBillForm/types";

export interface IFamilyPickerProps {
  row: IItemSearchRow;
  onClose: () => void;
  onPickItem: (item: Item) => void;
  onPickTinted: (item: Item, pick: ITintedPick) => void;
}
