import {
  formatQuantity,
  paiseToInput,
  parseQuantity,
  parseRupees,
  type ITintChargeRow,
} from "@shopos/core";

/** A charge row as typed: litres and rupees. */
export interface IChargeRowText {
  key: string;
  sizeText: string;
  chargeText: string;
}

export const toRowText = (rule: ITintChargeRow): IChargeRowText => ({
  key: crypto.randomUUID(),
  sizeText: formatQuantity(rule.declaredQtyMilli),
  chargeText: paiseToInput(rule.chargePaise),
});

/** The rules to save, or null when any row lacks a size above 0 or a charge. Sizes are litres. */
export function toRules(rows: readonly IChargeRowText[]): ITintChargeRow[] | null {
  const rules = rows.map((row) => ({
    declaredQtyMilli: parseQuantity(row.sizeText) ?? 0,
    declaredUom: "litre",
    chargePaise: parseRupees(row.chargeText),
  }));
  const isComplete = rules.every((rule) => rule.declaredQtyMilli > 0 && rule.chargePaise !== null);
  return isComplete ? rules.map((rule) => ({ ...rule, chargePaise: rule.chargePaise! })) : null;
}
