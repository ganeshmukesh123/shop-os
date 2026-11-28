import { useState } from "react";
import type { Item } from "@shopos/core";
import { call, messageOf } from "../../../../../shared/api/api";
import { uiText } from "../../../../../shared/text/strings";
import { useSurvivorSearch } from "../useSurvivorSearch";

/** What the owner still has to give before merging, or null. */
function missingField(survivor: Item | null, reason: string): string | null {
  if (!survivor) return uiText.merge.survivorRequired;
  return reason.trim() === "" ? uiText.merge.reasonRequired : null;
}

/**
 * The merge form (spec 002 T051): find the item to keep among other active items in the same
 * unit, require a reason, then items.merge. Main checks the same rules again.
 */
export function useMergeForm(item: Item, onMerged: (survivor: Item) => void) {
  const search = useSurvivorSearch(item);
  const [survivorId, setSurvivorId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const survivor = search.matches.find((match) => match.id === survivorId) ?? null;

  const merge = async () => {
    const missing = missingField(survivor, reason);
    if (missing) return setError(missing);
    setIsBusy(true);
    try {
      const input = { survivorId, mergedId: item.id, reason: reason.trim() };
      onMerged((await call("items.merge", input)).survivor);
    } catch (caughtError) {
      setError(messageOf(caughtError));
    } finally {
      setIsBusy(false);
    }
  };

  return { ...search, survivor, setSurvivorId, reason, setReason, error, isBusy, merge };
}
