import { useState } from "react";
import { MAX_AXES } from "@shopos/core";
import { uiText } from "../../../../shared/text/strings";
import { parseAxisValues } from "./familyDraft";

/** The attributes chosen (at most 4, with the reason when a fifth is refused) and their values. */
export function useAxisPicker() {
  const [axisKeys, setAxisKeys] = useState<string[]>([]);
  const [axisValuesText, setAxisValues] = useState<Record<string, string>>({});
  const [axisLimitReason, setAxisLimitReason] = useState<string | null>(null);

  // Read the current list inside the updater: several toggles in one event must each see the last
  const toggleAxis = (key: string) =>
    setAxisKeys((current) => {
      const isChosen = current.includes(key);
      const isFull = !isChosen && current.length >= MAX_AXES;
      setAxisLimitReason(isFull ? uiText.family.axisLimit : null);
      if (isFull) return current;
      return isChosen ? current.filter((chosenKey) => chosenKey !== key) : [...current, key];
    });

  const setAxisValuesText = (key: string, valuesText: string) =>
    setAxisValues((current) => ({ ...current, [key]: valuesText }));

  /** The values typed for each chosen attribute, as families.previewVariants takes them. */
  const axisValues = () =>
    Object.fromEntries(axisKeys.map((key) => [key, parseAxisValues(axisValuesText[key] ?? "")]));

  return { axisKeys, axisValuesText, axisLimitReason, toggleAxis, setAxisValuesText, axisValues };
}
