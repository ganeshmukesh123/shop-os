import { useState } from "react";
import type { FamiliesCreateInput, IFamily } from "@shopos/core";
import { call, messageOf } from "../../../../shared/api/api";
import { duplicateDrafts } from "./familyDraft";
import type { IPreviewRow } from "./types";
import { useDuplicateCheck } from "./useDuplicateCheck";

interface IFamilySaveOptions {
  /** The families.create input, or the reasons it cannot be sent yet */
  buildDraft: () => { errors: string[]; input: FamiliesCreateInput | null };
  rows: readonly IPreviewRow[];
  setErrors: (errors: string[]) => void;
  onSaved: (family: IFamily) => void;
}

/**
 * Save the family (spec 002 T036, T050): show likely duplicates first, unless the owner chose
 * Save anyway, then families.create.
 */
export function useFamilySave({ buildDraft, rows, setErrors, onSaved }: IFamilySaveOptions) {
  const [isBusy, setIsBusy] = useState(false);
  const duplicateCheck = useDuplicateCheck();

  const save = async (isDuplicateAccepted = false) => {
    const draft = buildDraft();
    setErrors(draft.errors);
    if (!draft.input) return;
    setIsBusy(true);
    try {
      const duplicates = isDuplicateAccepted
        ? []
        : await duplicateCheck.findDuplicates(duplicateDrafts(draft.input, rows));
      if (duplicates.length > 0) return;
      onSaved((await call("families.create", draft.input)).family);
    } catch (caughtError) {
      setErrors([messageOf(caughtError)]);
    } finally {
      setIsBusy(false);
    }
  };

  const saveAnyway = () => {
    duplicateCheck.clearDuplicates();
    void save(true);
  };

  return { isBusy, save, saveAnyway, duplicates: duplicateCheck.duplicates };
}
