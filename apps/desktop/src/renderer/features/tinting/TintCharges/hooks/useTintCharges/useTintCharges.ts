import { useEffect, useState } from "react";
import { call, messageOf } from "../../../../../shared/api/api";
import { useToast } from "../../../../../shared/components/Toast";
import { uiText } from "../../../../../shared/text/strings";
import { toRowText, toRules, type IChargeRowText } from "../../chargeRows";

/** Load, edit and save the tint charge per pack size (spec 002 T066). */
export function useTintCharges() {
  const toast = useToast();
  const [rows, setRows] = useState<IChargeRowText[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Read the charges from main once, when the tab opens
  useEffect(() => {
    void call("tint.charges.list", {}).then((found) => setRows(found.rules.map(toRowText)));
  }, []);

  const change = (key: string, patch: Partial<IChargeRowText>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const addRow = () =>
    setRows((current) => [...current, { key: crypto.randomUUID(), sizeText: "", chargeText: "" }]);
  const removeRow = (key: string) => setRows((current) => current.filter((row) => row.key !== key));

  const save = async () => {
    const rules = toRules(rows);
    if (!rules) return setError(uiText.tinting.charges.incomplete);
    try {
      await call("tint.charges.save", { rules });
      setError(null);
      toast("success", uiText.tinting.charges.saved);
    } catch (caughtError) {
      setError(messageOf(caughtError));
    }
  };

  return { rows, error, change, addRow, removeRow, save };
}
