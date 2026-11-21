import { parseQuantity, parseRupees } from "@shopos/core";
import { fillText } from "../../../../shared/text/fillText";
import { uiText } from "../../../../shared/text/strings";
import type { IItemFormValidation, IItemFormValues } from "./types";

const MAX_UNIT_LENGTH = 20;
const WHOLE_UNIT_MILLI = 1000;

function readOpeningQuantity(openingText: string, errors: string[]): number {
  if (openingText.trim() === "") return 0;
  const openingQtyMilli = parseQuantity(openingText);
  if (openingQtyMilli !== null) return openingQtyMilli;
  errors.push(uiText.form.openingInvalid);
  return 0;
}

/** Checks what was typed into the item form and reads the price and the opening stock. */
export function validateItemForm(values: IItemFormValues): IItemFormValidation {
  const errors: string[] = [];
  if (!values.name.trim()) errors.push(uiText.form.nameRequired);
  if (!values.unit) errors.push(uiText.form.unitRequired);
  if (values.unit.length > MAX_UNIT_LENGTH)
    errors.push(fillText(uiText.form.unitTooLong, { maxLength: MAX_UNIT_LENGTH }));
  const pricePaise = parseRupees(values.priceText);
  if (pricePaise === null) errors.push(uiText.form.priceInvalid);
  const openingQtyMilli = values.isEditing ? 0 : readOpeningQuantity(values.openingText, errors);
  if (!values.isEditing && !values.allowsDecimal && openingQtyMilli % WHOLE_UNIT_MILLI !== 0)
    errors.push(uiText.form.wholeNumbersOnly);
  return { errors, pricePaise, openingQtyMilli };
}
