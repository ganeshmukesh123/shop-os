import {
  defaultAllowsDecimal,
  parseQuantity,
  parseRupees,
  type FamiliesCreateInput,
  type FamilyKind,
  type ItemsCheckDuplicatesInput,
} from "@shopos/core";
import { uiText } from "../../../../shared/text/strings";
import { paintErrors, paintVariantFields } from "./paintDraft";
import type { IFamilyFormState, IPreviewRow } from "./types";

const WHOLE_UNIT_MILLI = 1000;

/** "0.5 in, 1 in, " gives ["0.5 in", "1 in"]: trimmed, empty pieces dropped. */
export function parseAxisValues(valuesText: string): string[] {
  return valuesText
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
}

interface IReadRow {
  row: IPreviewRow;
  pricePaise: number | null;
  openingQtyMilli: number | null;
}

function readRow(row: IPreviewRow, allowDecimal: boolean): IReadRow {
  const openingQtyMilli = row.openingText.trim() === "" ? 0 : parseQuantity(row.openingText);
  const isWhole = openingQtyMilli !== null && openingQtyMilli % WHOLE_UNIT_MILLI === 0;
  return {
    row,
    pricePaise: parseRupees(row.priceText),
    openingQtyMilli: allowDecimal || isWhole ? openingQtyMilli : null,
  };
}

/** The messages for what is missing or mistyped; empty means the family can be sent. */
function draftErrors(state: IFamilyFormState, readRows: readonly IReadRow[]): string[] {
  const text = uiText.family;
  return [
    state.name.trim() === "" ? text.nameRequired : null,
    state.unit === "" ? text.unitRequired : null,
    readRows.length === 0 ? text.noneChosen : null,
    readRows.some(({ pricePaise }) => pricePaise === null) ? text.priceInvalid : null,
    readRows.some(({ openingQtyMilli }) => openingQtyMilli === null) ? text.openingInvalid : null,
  ].filter((message): message is NonNullable<typeof message> => message !== null);
}

/** One duplicate check per kept variant: its full name ("Pipe PVC 1 in") and attribute values. */
export function duplicateDrafts(
  input: FamiliesCreateInput,
  rows: readonly IPreviewRow[],
): ItemsCheckDuplicatesInput["draft"][] {
  return rows
    .filter((row) => row.isChosen)
    .map((row) => ({
      name: `${input.family.name} ${row.displayName}`.trim(),
      brandId: input.family.brandId ?? null,
      categoryId: input.family.categoryId ?? null,
      axisSignature: row.axisSignature,
    }));
}

/**
 * The families.create input for the ticked rows, or the reasons it cannot be sent yet. Prices are
 * rupees to paise, opening stock is thousandths; whole-number units take whole opening stock.
 */
export function buildCreateInput(state: IFamilyFormState): {
  errors: string[];
  input: FamiliesCreateInput | null;
} {
  const allowDecimal = defaultAllowsDecimal(state.unit);
  const readRows = state.rows
    .filter((row) => row.isChosen)
    .map((row) => readRow(row, allowDecimal));
  const kind = state.kind as FamilyKind;
  const errors = [...draftErrors(state, readRows), ...paintErrors(kind, state.paint, allowDecimal)];
  if (errors.length > 0) return { errors, input: null };
  const family = {
    name: state.name.trim(),
    kind,
    ...(state.categoryId ? { categoryId: state.categoryId } : {}),
    ...(state.brandId ? { brandId: state.brandId } : {}),
    spec: {},
    axisKeys: state.axisKeys,
  };
  const extraFields = paintVariantFields(kind, state.paint);
  const variants = readRows.map(({ row, pricePaise, openingQtyMilli }) => ({
    axes: row.axes,
    baseUom: state.unit,
    allowDecimal,
    sellingPricePaise: pricePaise!,
    openingQtyMilli: openingQtyMilli!,
    ...extraFields,
  }));
  return { errors: [], input: { family, variants } as FamiliesCreateInput };
}
