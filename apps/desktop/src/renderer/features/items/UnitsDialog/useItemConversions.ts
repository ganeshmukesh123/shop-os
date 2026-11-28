import { useEffect, useState } from "react";
import type { IUnitConversion, Item } from "@shopos/core";
import { call, messageOf } from "../../../shared/api/api";

/** This item's saved conversions (from its family's), or the reason they could not be read. */
export function useItemConversions(item: Item) {
  const [conversions, setConversions] = useState<IUnitConversion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let isCurrent = true;
    call("families.get", { id: item.familyId ?? "" })
      .then((detail) => {
        const own = detail.conversions.filter((conversion) => conversion.variantId === item.id);
        if (isCurrent) setConversions(own);
      })
      .catch((caughtError) => {
        if (isCurrent) setError(messageOf(caughtError));
      });
    return () => {
      isCurrent = false;
    };
  }, [item.familyId, item.id]);
  return { conversions, error };
}
