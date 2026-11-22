import { useState } from "react";
import { defaultAllowsDecimal, paiseToInput, UNITS, type Item } from "@shopos/core";
import { CUSTOM_UNIT_OPTION } from "../constants";
import type { IItemFormFields } from "./types";

/** What is typed into the item form: new and empty, or filled from the item being edited. */
export function useItemFormFields(item?: Item): IItemFormFields {
  const startUnit = item?.unit ?? "pcs";
  const isBuiltinUnit = (UNITS as readonly string[]).includes(startUnit);
  const [name, setName] = useState(item?.name ?? "");
  const [unitChoice, setUnitChoice] = useState(isBuiltinUnit ? startUnit : CUSTOM_UNIT_OPTION);
  const [customUnit, setCustomUnit] = useState(isBuiltinUnit ? "" : startUnit);
  const [decimalChoice, setDecimalChoice] = useState<boolean | null>(
    item ? item.allowsDecimal : null,
  );
  const [priceText, setPriceText] = useState(item ? paiseToInput(item.pricePaise) : "");
  const [openingText, setOpeningText] = useState("");

  const unit = unitChoice === CUSTOM_UNIT_OPTION ? customUnit.trim() : unitChoice;
  const chooseUnit = (selectedUnit: string) => {
    setUnitChoice(selectedUnit);
    setDecimalChoice(null);
  };

  return {
    name,
    unitChoice,
    customUnit,
    priceText,
    openingText,
    unit,
    allowsDecimal: decimalChoice ?? defaultAllowsDecimal(unit),
    isEditing: Boolean(item),
    setName,
    chooseUnit,
    setCustomUnit,
    setAllowsDecimal: setDecimalChoice,
    setPriceText,
    setOpeningText,
  };
}
