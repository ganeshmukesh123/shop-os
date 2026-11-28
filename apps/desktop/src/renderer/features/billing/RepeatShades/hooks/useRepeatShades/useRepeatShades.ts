import { useEffect, useState } from "react";
import type { ITintRepeat, Item } from "@shopos/core";
import { call } from "../../../../../shared/api/api";
import type { ITintedPick } from "../../../NewBillScreen/hooks/useBillForm/types";
import { variantAsItem } from "../../../TintPicker/tintPick";
import { MIN_CUSTOMER_LENGTH } from "../../constants";
import { pickOfRepeat } from "../../repeatPick";

/** Today's price for the can and shade; the can's own price if the shade cannot be resolved now. */
async function priceOf(repeat: ITintRepeat): Promise<number> {
  const input = {
    productFamilyId: repeat.baseVariant.familyId,
    shadeId: repeat.shade.id,
    packVariantId: repeat.baseVariant.id,
  };
  return call("tint.resolve", input)
    .then((resolved) => resolved.unitPricePaise)
    .catch(() => repeat.baseVariant.sellingPricePaise);
}

/** The customer's shades as the name is typed (spec 002 T065); a tap adds one at today's price. */
export function useRepeatShades(
  customerName: string,
  onAdd: (item: Item, pick: ITintedPick) => void,
) {
  const [repeats, setRepeats] = useState<ITintRepeat[]>([]);
  const name = customerName.trim();

  // Ask main for the customer's shades whenever the typed name changes; drop a stale answer
  useEffect(() => {
    let isCurrent = true;
    if (name.length < MIN_CUSTOMER_LENGTH) {
      setRepeats([]);
      return undefined;
    }
    void call("tint.repeat.list", { customerName: name }).then(
      (found) => isCurrent && setRepeats(found.shades),
    );
    return () => {
      isCurrent = false;
    };
  }, [name]);

  const add = async (repeat: ITintRepeat) =>
    onAdd(variantAsItem(repeat.baseVariant), pickOfRepeat(repeat, await priceOf(repeat)));
  return { repeats, add };
}
