import { TintPicker } from "../../../TintPicker";
import { VariantGrid } from "../../../VariantGrid";
import type { IFamilyPickerProps } from "./types";

/** A family chosen in the bill search: a base paint opens the tinting desk (T064), others the grid (T038). */
export function FamilyPicker({
  row,
  customerName,
  onClose,
  onPickItem,
  onPickTinted,
}: IFamilyPickerProps) {
  return row.familyKind === "base_paint" ? (
    <TintPicker
      familyId={row.id}
      title={row.displayName}
      customerName={customerName}
      onClose={onClose}
      onAdd={onPickTinted}
    />
  ) : (
    <VariantGrid familyId={row.id} title={row.displayName} onClose={onClose} onPick={onPickItem} />
  );
}
