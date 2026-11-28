import { businessDateOf, tintMixText, type ITintRepeat } from "@shopos/core";
import { uiText } from "../../../shared/text/strings";
import type { ITintedPick } from "../NewBillScreen/hooks/useBillForm/types";
import { SHOP_TIME_ZONE } from "./constants";

/** "Sky Blue, Royale Pastel 4 L: Blue 12.5 ml, Black 0.75 ml". */
export const entryText = (repeat: ITintRepeat) =>
  uiText.bill.repeat.entry
    .replace("{shade}", repeat.shade.shadeName)
    .replace("{can}", repeat.baseVariant.displayName)
    .replace("{mix}", tintMixText(repeat.lines));

export const whenText = (repeat: ITintRepeat) =>
  repeat.lastBilledAt === null
    ? uiText.bill.repeat.neverBilled
    : uiText.bill.repeat.lastBilled.replace(
        "{date}",
        businessDateOf(repeat.lastBilledAt, SHOP_TIME_ZONE),
      );

/** A billed shade repeats its saved line; one never billed uses its formula (contracts). */
export const pickOfRepeat = (repeat: ITintRepeat, ratePaise: number): ITintedPick => ({
  tint: repeat.sourceBillLineId
    ? { sourceBillLineId: repeat.sourceBillLineId }
    : { formulaId: repeat.formula.id },
  ratePaise,
  label: `${repeat.shade.shadeName}: ${tintMixText(repeat.lines)}`,
});
