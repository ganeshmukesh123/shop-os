import type { IGridTab, Item } from "@shopos/core";

export interface IGridTableProps {
  tab: IGridTab;
  items: readonly Item[];
  onPick: (item: Item) => void;
}
