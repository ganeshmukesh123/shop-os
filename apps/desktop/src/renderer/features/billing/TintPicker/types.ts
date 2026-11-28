import type { Item } from "@shopos/core";
import type { ITintedPick } from "../NewBillScreen/hooks/useBillForm/types";

export interface ITintPickerProps {
  /** The base-paint family chosen in the bill search */
  familyId: string;
  title: string;
  onAdd: (item: Item, pick: ITintedPick) => void;
  onClose: () => void;
  /** The bill's customer, offered as the custom shade's customer label */
  customerName?: string;
}
