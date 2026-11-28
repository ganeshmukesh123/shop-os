import { useState } from "react";
import type { ILikelyDuplicate, ItemsCheckDuplicatesInput } from "@shopos/core";
import { call } from "../../../../shared/api/api";

type IDuplicateDraft = ItemsCheckDuplicatesInput["draft"];

/** Each existing item once, whichever kept variant it looked like. */
const onePerItem = (found: readonly ILikelyDuplicate[]) =>
  found.filter(
    (candidate, candidateIndex) =>
      found.findIndex((other) => other.variantId === candidate.variantId) === candidateIndex,
  );

/**
 * Likely duplicates of the family's kept variants (spec 002 T050, FR-008). The check only warns:
 * if it fails, the save goes ahead.
 */
export function useDuplicateCheck() {
  const [duplicates, setDuplicates] = useState<ILikelyDuplicate[]>([]);

  const findDuplicates = async (drafts: readonly IDuplicateDraft[]) => {
    try {
      const answers = await Promise.all(
        drafts.map((draft) => call("items.checkDuplicates", { draft })),
      );
      const found = onePerItem(answers.flatMap((answer) => answer.candidates));
      setDuplicates(found);
      return found;
    } catch {
      return [];
    }
  };

  return { duplicates, findDuplicates, clearDuplicates: () => setDuplicates([]) };
}
