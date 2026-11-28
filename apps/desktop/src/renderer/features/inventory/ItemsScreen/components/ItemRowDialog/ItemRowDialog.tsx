import { MergeDialog } from "../../../../items/MergeDialog";
import { UnitsDialog } from "../../../../items/UnitsDialog";
import type { IItemRowDialogProps } from "./types";

/** The dialog an item row opened: its other units (spec 002 T037) or a merge (T051). */
export function ItemRowDialog({ dialog, onClose, onMerged }: IItemRowDialogProps) {
  return dialog.kind === "units" ? (
    <UnitsDialog item={dialog.item} onClose={onClose} />
  ) : (
    <MergeDialog item={dialog.item} onClose={onClose} onMerged={onMerged} />
  );
}
