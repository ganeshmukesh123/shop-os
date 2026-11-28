import { addPaise, type Paise } from "../money";

/** A tint charge for one declared pack size (1 L, 4 L, 10 L, 20 L), from tint_charge_rule. */
export interface ITintChargeRule {
  packQtyMilli: number;
  chargePaise: Paise;
}

/** The charge for a pack of exactly this declared size, or null when none is set. */
export function tintChargeFor(
  declaredQtyMilli: number,
  rules: readonly ITintChargeRule[],
): Paise | null {
  return rules.find((rule) => rule.packQtyMilli === declaredQtyMilli)?.chargePaise ?? null;
}

/**
 * The price of one tinted can (FR-015, research D11): the shade's own price if it has one, with
 * no charge on top; otherwise the base price plus the pack's tint charge.
 */
export function tintLinePrice(prices: {
  basePricePaise: Paise;
  shadePricePaise: Paise | null;
  tintChargePaise: Paise | null;
}): { unitPricePaise: Paise; tintChargePaise: Paise } {
  if (prices.shadePricePaise !== null) {
    return { unitPricePaise: prices.shadePricePaise, tintChargePaise: 0 };
  }
  const tintChargePaise = prices.tintChargePaise ?? 0;
  return { unitPricePaise: addPaise(prices.basePricePaise, tintChargePaise), tintChargePaise };
}
