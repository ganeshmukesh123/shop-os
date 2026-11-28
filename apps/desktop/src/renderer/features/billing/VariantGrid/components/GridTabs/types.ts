import type { IGridTab, Item } from "@shopos/core";

export interface IGridTabsProps {
  tabs: readonly IGridTab[];
  items: readonly Item[];
  onPick: (item: Item) => void;
}
