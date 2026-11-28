import { parseQuantity, type FamilyKind, type PetroleumClass } from "@shopos/core";
import { uiText } from "../../../../shared/text/strings";
import type { IPaintFields } from "./types";

const MAX_WARRANTY_MONTHS = 120;
const MAX_TRADE_LABEL_LENGTH = 20;

export const EMPTY_PAINT_FIELDS: IPaintFields = {
  petroleumClass: "",
  declaredQtyText: "",
  declaredUom: "",
  tradeLabel: "",
  sealedPackOnly: false,
  warrantyText: "",
  isSerialTracked: false,
};

/** Paint, base paint, colorant and thinner carry the paint fields (FR-009); general items do not. */
export const hasPaintFields = (kind: FamilyKind) => kind !== "general";

function readWarranty(warrantyText: string): number | null | "invalid" {
  if (warrantyText.trim() === "") return null;
  const months = Number(warrantyText.trim());
  return Number.isInteger(months) && months >= 0 && months <= MAX_WARRANTY_MONTHS
    ? months
    : "invalid";
}

function readDeclaredQty(declaredQtyText: string): number | null | "invalid" {
  if (declaredQtyText.trim() === "") return null;
  const declaredQtyMilli = parseQuantity(declaredQtyText);
  return declaredQtyMilli !== null && declaredQtyMilli > 0 ? declaredQtyMilli : "invalid";
}

const onlyMessages = (messages: readonly (string | null)[]) =>
  messages.filter((message): message is string => message !== null);

/** The paint-only rules (FR-009): class, declared pack, label length, sealed pack in whole units. */
function paintOnlyErrors(paint: IPaintFields, allowDecimal: boolean): string[] {
  const text = uiText.family.paint;
  const declaredQty = readDeclaredQty(paint.declaredQtyText);
  const isDeclaredMissing = declaredQty === null || paint.declaredUom === "";
  return onlyMessages([
    paint.petroleumClass === "" ? text.classRequired : null,
    isDeclaredMissing ? text.declaredRequired : null,
    declaredQty === "invalid" ? text.declaredInvalid : null,
    paint.tradeLabel.trim().length > MAX_TRADE_LABEL_LENGTH ? text.tradeLabelTooLong : null,
    paint.sealedPackOnly && allowDecimal ? text.sealedDecimal : null,
  ]);
}

/** Why these fields cannot be sent (the same rules core's validateVariantDraft applies again). */
export function paintErrors(
  kind: FamilyKind,
  paint: IPaintFields,
  allowDecimal: boolean,
): string[] {
  const isWarrantyInvalid = readWarranty(paint.warrantyText) === "invalid";
  return [
    ...(hasPaintFields(kind) ? paintOnlyErrors(paint, allowDecimal) : []),
    ...onlyMessages([isWarrantyInvalid ? uiText.family.paint.warrantyInvalid : null]),
  ];
}

/** The fields each variant gets; a general item sends no paint fields. Call after paintErrors. */
export function paintVariantFields(kind: FamilyKind, paint: IPaintFields) {
  const isPaint = hasPaintFields(kind);
  const warranty = readWarranty(paint.warrantyText);
  const declaredQty = readDeclaredQty(paint.declaredQtyText);
  return {
    petroleumClass: isPaint ? (paint.petroleumClass as PetroleumClass) : null,
    declaredQtyMilli: isPaint && typeof declaredQty === "number" ? declaredQty : null,
    declaredUom: isPaint ? paint.declaredUom : null,
    tradeLabel: isPaint && paint.tradeLabel.trim() !== "" ? paint.tradeLabel.trim() : null,
    sealedPackOnly: isPaint && paint.sealedPackOnly,
    warrantyMonths: typeof warranty === "number" ? warranty : null,
    isSerialTracked: paint.isSerialTracked,
  };
}
