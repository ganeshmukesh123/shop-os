import { useState } from "react";
import { call, messageOf } from "../../../../shared/api/api";
import { buildConversions, emptyRow, toRows } from "./conversionRows";
import type { IConversionRow, IUseUnitConversionsOptions } from "./types";

/** The logic of the other-units panel (spec 002 T037): edit rows, then variants.setConversions. */
export function useUnitConversions({ variantId, conversions }: IUseUnitConversionsOptions) {
  const [rows, setRows] = useState<IConversionRow[]>(() => toRows(conversions));
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaved, setIsSaved] = useState(false);

  const updateRow = (key: string, change: Partial<IConversionRow>) => {
    setIsSaved(false);
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  };

  const save = async () => {
    const draft = buildConversions(rows);
    setErrors(draft.errors);
    if (draft.errors.length > 0) return;
    try {
      const saved = await call("variants.setConversions", {
        variantId,
        conversions: draft.conversions,
      });
      setRows(toRows(saved.conversions));
      setIsSaved(true);
    } catch (caughtError) {
      setErrors([messageOf(caughtError)]);
    }
  };

  return {
    rows,
    errors,
    isSaved,
    save,
    addRow: () => setRows((current) => [...current, emptyRow()]),
    removeRow: (key: string) => setRows((current) => current.filter((row) => row.key !== key)),
    setUnit: (key: string, uomCode: string) => updateRow(key, { uomCode }),
    setHolds: (key: string, holdsText: string) => updateRow(key, { holdsText }),
  };
}
