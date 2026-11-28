import { formatQuantity, parseQuantity, type IUnitConversion } from "@shopos/core";
import { fillText } from "../../../../shared/text/fillText";
import { uiText } from "../../../../shared/text/strings";
import type { IConversionRow } from "./types";

/** A key for React to tell rows apart; never saved. */
const newRowKey = () => crypto.randomUUID();

/** The saved conversions as editable rows: 90000 milli of metre in a roll shows as "90". */
export function toRows(conversions: readonly IUnitConversion[]): IConversionRow[] {
  return conversions.map((conversion) => ({
    key: newRowKey(),
    uomCode: conversion.uomCode,
    holdsText: formatQuantity(conversion.factorMilli),
  }));
}

export const emptyRow = (): IConversionRow => ({ key: newRowKey(), uomCode: "", holdsText: "" });

/** "1 roll = 90 metre" for a row with a unit and a valid quantity, else null. */
export function exampleOf(row: IConversionRow, baseUnit: string): string | null {
  const factorMilli = parseQuantity(row.holdsText);
  if (row.uomCode === "" || factorMilli === null || factorMilli === 0) return null;
  return fillText(uiText.family.units.example, {
    unit: row.uomCode,
    quantity: formatQuantity(factorMilli),
    baseUnit,
  });
}

/** The variants.setConversions list, or the reasons it cannot be sent (main checks again). */
export function buildConversions(rows: readonly IConversionRow[]): {
  errors: string[];
  conversions: { uomCode: string; factorMilli: number }[];
} {
  const text = uiText.family.units;
  const unitCodes = rows.map((row) => row.uomCode);
  const badRows = rows.filter((row) => {
    const factorMilli = parseQuantity(row.holdsText);
    return row.uomCode !== "" && (factorMilli === null || factorMilli === 0);
  });
  const errors = [
    unitCodes.includes("") ? text.unitRequired : null,
    new Set(unitCodes).size !== unitCodes.length ? text.repeated : null,
    ...badRows.map((row) => fillText(text.factorInvalid, { unit: row.uomCode })),
  ].filter((message): message is string => message !== null);
  const conversions = rows.map((row) => ({
    uomCode: row.uomCode,
    factorMilli: parseQuantity(row.holdsText) ?? 0,
  }));
  return { errors, conversions: errors.length === 0 ? conversions : [] };
}
