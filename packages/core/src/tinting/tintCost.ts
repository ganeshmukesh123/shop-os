import { addPaise, sumQtyRatesRounded, type Paise } from "../money";

/** One colorant in the can: its purchase price per ml and the amount used, in thousandths of a ml. */
export interface IColorantCost {
  pricePerMlPaise: Paise;
  qtyMilli: number;
}

/**
 * What a tinted can cost the shop (FR-015, research D11): the base's purchase price plus each
 * colorant's price per ml x ml, the colorants rounded half up once in total.
 */
export function tintCostPaise(cost: {
  basePurchasePaise: Paise;
  colorants: readonly IColorantCost[];
}): Paise {
  const colorantPaise = sumQtyRatesRounded(
    cost.colorants.map(({ pricePerMlPaise, qtyMilli }) => ({
      quantityMilli: qtyMilli,
      ratePaise: pricePerMlPaise,
    })),
  );
  return addPaise(cost.basePurchasePaise, colorantPaise);
}
