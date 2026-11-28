import { useState } from "react";
import type { Item } from "@shopos/core";
import { call } from "../../../../../shared/api/api";

/**
 * A code entered with Enter (a scanner types it and presses Enter): one item is added, two or more
 * open the chooser, none falls back to the search (spec 002 T052, EC-07).
 */
export function useBarcodeEntry(onAdd: (item: Item) => void) {
  const [choice, setChoice] = useState<{ code: string; items: Item[] } | null>(null);

  const enterCode = async (code: string, fallBackToSearch: () => void) => {
    const found = await call("items.lookupBarcode", { code }).catch(() => ({ variants: [] }));
    if (found.variants.length === 0) return fallBackToSearch();
    if (found.variants.length === 1) return onAdd(found.variants[0]!);
    setChoice({ code, items: found.variants });
  };

  return { choice, enterCode, closeChoice: () => setChoice(null) };
}
