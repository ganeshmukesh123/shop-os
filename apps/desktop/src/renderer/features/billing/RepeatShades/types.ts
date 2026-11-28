import type { Item } from "@shopos/core";
import type { ITintedPick } from "../NewBillScreen/hooks/useBillForm/types";

export interface IRepeatShadesProps {
  customerName: string;
  onAdd: (item: Item, pick: ITintedPick) => void;
}
