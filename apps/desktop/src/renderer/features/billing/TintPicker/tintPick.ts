import {
  formatQuantity,
  formatRupees,
  tintMixText,
  type ITintResolved,
  type IVariant,
  type Item,
} from "@shopos/core";
import { uiText } from "../../../shared/text/strings";

/** A base can as the bill form's Item. */
export const variantAsItem = (variant: IVariant): Item => ({
  id: variant.id,
  name: variant.displayName,
  unit: variant.baseUom,
  allowsDecimal: variant.allowDecimal,
  pricePaise: variant.sellingPricePaise,
  stockMilli: variant.stockMilli,
  active: variant.isActive,
  needsCorrection: variant.stockMilli < 0,
  familyId: variant.familyId,
});

/** "₹1,450.00 + tint ₹60.00 = ₹1,510.00", or "Shade price ₹1,550.00" when the shade has a price. */
export function priceText(resolved: ITintResolved): string {
  const text = uiText.bill.tintPicker;
  const total = formatRupees(resolved.unitPricePaise);
  return resolved.chargePaise > 0
    ? text.withCharge
        .replace("{base}", formatRupees(resolved.unitPricePaise - resolved.chargePaise))
        .replace("{charge}", formatRupees(resolved.chargePaise))
        .replace("{total}", total)
    : text.shadePrice.replace("{total}", total);
}

/** The words under the bill line: "Sky Blue: Blue 12.5 ml, Black 0.75 ml". */
export const tintLabelOf = (shadeName: string, resolved: ITintResolved) =>
  `${shadeName}: ${tintMixText(resolved.lines)}`;

export const amountText = (qtyMilli: number) => `${formatQuantity(qtyMilli)} ml`;
