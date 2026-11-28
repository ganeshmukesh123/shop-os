import { useState } from "react";
import { parseQuantity, type ITintShade, type Item } from "@shopos/core";
import { call, messageOf } from "../../../../../shared/api/api";
import { uiText } from "../../../../../shared/text/strings";
import { useColorantSearch } from "../useColorantSearch";
import type { ICustomShadeDraft, IDraftColorant } from "./types";

/** The colorant lines in thousandths of a ml, or null if any amount is missing or not above 0. */
function linesOf(colorants: readonly IDraftColorant[]) {
  const lines = colorants.map((colorant) => ({
    colorantVariantId: colorant.item.id,
    qtyMilli: parseQuantity(colorant.amountText) ?? 0,
  }));
  return lines.length > 0 && lines.every((line) => line.qtyMilli > 0) ? lines : null;
}

/** A custom shade for the chosen can (spec 002 T064, FR-016), saved with tint.customShade.save. */
export function useCustomShade(
  baseVariantId: string,
  customerName: string,
  onSaved: (shade: ITintShade) => void,
) {
  const search = useColorantSearch();
  const [draft, setDraft] = useState<ICustomShadeDraft>({
    name: "",
    customerLabel: customerName,
    siteLabel: "",
    colorants: [],
  });
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<ICustomShadeDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const save = async () => {
    const lines = linesOf(draft.colorants);
    if (draft.name.trim() === "" || !lines)
      return setError(uiText.bill.tintPicker.custom.incomplete);
    const labels = {
      ...(draft.customerLabel.trim() ? { customerLabel: draft.customerLabel.trim() } : {}),
      ...(draft.siteLabel.trim() ? { siteLabel: draft.siteLabel.trim() } : {}),
    };
    try {
      const saved = await call("tint.customShade.save", {
        shadeName: draft.name.trim(),
        ...labels,
        baseVariantId,
        lines,
      });
      onSaved(saved.shade);
    } catch (caughtError) {
      setError(messageOf(caughtError));
    }
  };

  const addColorant = (item: Item) =>
    change({ colorants: [...draft.colorants, { item, amountText: "" }] });
  return { search, draft, change, addColorant, error, save };
}
