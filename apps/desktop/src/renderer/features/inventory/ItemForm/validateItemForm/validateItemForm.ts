import { parseQuantity, parseRupees } from "@shopos/core";
import type { IItemFormValidation, IItemFormValues } from "./types";

const MAX_UNIT_LENGTH = 20;
const WHOLE_UNIT_MILLI = 1000;

function readOpeningQuantity(openingText: string, errors: string[]): number {
  if (openingText.trim() === "") return 0;
  const openingQtyMilli = parseQuantity(openingText);
  if (openingQtyMilli !== null) return openingQtyMilli;
  errors.push("Enter the opening quantity as a number, for example 10 or 2.5");
  return 0;
}

/** Checks what was typed into the item form and reads the price and the opening stock. */
export function validateItemForm(values: IItemFormValues): IItemFormValidation {
  const errors: string[] = [];
  if (!values.name.trim()) errors.push("Enter the item name");
  if (!values.unit) errors.push("Choose or type a unit");
  if (values.unit.length > MAX_UNIT_LENGTH) errors.push("Unit name can be at most 20 characters");
  const pricePaise = parseRupees(values.priceText);
  if (pricePaise === null) errors.push("Enter the price in rupees, for example 120 or 49.50");
  const openingQtyMilli = values.isEditing ? 0 : readOpeningQuantity(values.openingText, errors);
  if (!values.isEditing && !values.allowsDecimal && openingQtyMilli % WHOLE_UNIT_MILLI !== 0)
    errors.push("This unit accepts whole numbers only");
  return { errors, pricePaise, openingQtyMilli };
}
