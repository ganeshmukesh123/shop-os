import { useState } from "react";
import { call, messageOf } from "../../../../shared/api/api";
import { buildCreateInput } from "./familyDraft";
import { EMPTY_PAINT_FIELDS } from "./paintDraft";
import type { IFamilyForm, IPaintFields, IUseFamilyFormOptions } from "./types";
import { useAxisPicker } from "./useAxisPicker";
import { useFamilyFields } from "./useFamilyFields";
import { useFamilySave } from "./useFamilySave";
import { usePreviewRows } from "./usePreviewRows";

/**
 * The logic of the new-family form (spec 002 T036): pick up to 4 attributes, type their values,
 * preview every combination, untick what is not stocked, give each kept one a price and opening
 * stock, and save the family with families.create. Main checks the same rules again.
 */
export function useFamilyForm({ onSaved }: IUseFamilyFormOptions): IFamilyForm {
  const fields = useFamilyFields();
  const axes = useAxisPicker();
  const table = usePreviewRows();
  const [errors, setErrors] = useState<string[]>([]);
  const [paint, setPaintFields] = useState<IPaintFields>(EMPTY_PAINT_FIELDS);
  const setPaint = (change: Partial<IPaintFields>) =>
    setPaintFields((current) => ({ ...current, ...change }));
  const saving = useFamilySave({
    buildDraft: () =>
      buildCreateInput({ ...fields, axisKeys: axes.axisKeys, rows: table.rows, paint }),
    rows: table.rows,
    setErrors,
    onSaved,
  });

  const preview = async () => {
    try {
      const input = { axisKeys: axes.axisKeys, axisValues: axes.axisValues() };
      table.showCombinations((await call("families.previewVariants", input)).combinations);
      setErrors([]);
    } catch (caughtError) {
      table.clearRows();
      setErrors([messageOf(caughtError)]);
    }
  };

  return { ...fields, ...axes, ...table, ...saving, paint, setPaint, errors, preview };
}
