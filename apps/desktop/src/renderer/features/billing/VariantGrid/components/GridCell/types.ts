import type { IGridCell, Item } from "@shopos/core";

export interface IGridCellProps {
  cell: IGridCell | null;
  item: Item | undefined;
  row: number;
  column: number;
  onPick: (item: Item) => void;
}
