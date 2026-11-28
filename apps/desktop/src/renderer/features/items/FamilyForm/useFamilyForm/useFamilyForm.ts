import { useState } from "react";
import { call, messageOf } from "../../../../shared/api/api";
import { buildCreateInput } from "./familyDraft";
import type { IFamilyForm, IUseFamilyFormOptions } from "./types";
import { useAxisPicker } from "./useAxisPicker";
import { useFamilyFields } from "./useFamilyFields";
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
  const [isBusy, setIsBusy] = useState(false);

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

  const save = async () => {
    const draft = buildCreateInput({ ...fields, axisKeys: axes.axisKeys, rows: table.rows });
    setErrors(draft.errors);
    if (!draft.input) return;
    setIsBusy(true);
    try {
      onSaved((await call("families.create", draft.input)).family);
    } catch (caughtError) {
      setErrors([messageOf(caughtError)]);
    } finally {
      setIsBusy(false);
    }
  };

  return { ...fields, ...axes, ...table, errors, isBusy, preview, save };
}
