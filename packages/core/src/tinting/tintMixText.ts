import { formatQuantity } from "../quantity";

/** What was mixed in one can, for the bill: "Blue 12.5 ml, Black 0.75 ml" (spec 002 T067). */
export function tintMixText(colorants: readonly { name: string; qtyMilli: number }[]): string {
  return colorants
    .map((colorant) => `${colorant.name} ${formatQuantity(colorant.qtyMilli)} ml`)
    .join(", ");
}
