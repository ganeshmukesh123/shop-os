import { ItemNamesPanel } from "../../../../items/ItemNamesPanel";
import { MergeDialog } from "../../../../items/MergeDialog";
import { UnitsDialog } from "../../../../items/UnitsDialog";
import type { IItemRowDialogProps } from "./types";

/** The dialog an item row opened: its other units (spec 002 T037), names and codes (T049) or a merge (T051). */
export function ItemRowDialog({ dialog, onClose, onMerged }: IItemRowDialogProps) {
  if (dialog.kind === "names") return <ItemNamesPanel item={dialog.item} onClose={onClose} />;
  return dialog.kind === "units" ? (
    <UnitsDialog item={dialog.item} onClose={onClose} />
  ) : (
    <MergeDialog item={dialog.item} onClose={onClose} onMerged={onMerged} />
  );
}
