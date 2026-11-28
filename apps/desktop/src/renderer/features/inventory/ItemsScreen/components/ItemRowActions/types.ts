import type { Item } from "@shopos/core";

export interface IItemRowActionsProps {
  item: Item;
  onEdit: () => void;
  onAdjust: () => void;
  onUnits: () => void;
  onMerge: () => void;
  onToggleActive: () => void;
}
