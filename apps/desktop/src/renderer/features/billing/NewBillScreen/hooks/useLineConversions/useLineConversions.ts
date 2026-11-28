import { useEffect, useRef } from "react";
import type { DraftLine } from "@shopos/core";
import { call } from "../../../../../shared/api/api";

/**
 * Reads each new line's other units (spec 002 T039) from its family once, and puts them on the
 * line. A line with no family (an old draft) gets none; a failed read leaves the base unit only.
 */
export function useLineConversions(
  lines: readonly DraftLine[],
  patchLine: (lineKey: string, patch: Partial<DraftLine>) => void,
): void {
  const requested = useRef(new Set<string>());
  useEffect(() => {
    lines
      .filter((line) => line.conversions === undefined && !requested.current.has(line.key))
      .forEach((line) => {
        requested.current.add(line.key);
        if (!line.familyId) return patchLine(line.key, { conversions: [] });
        call("families.get", { id: line.familyId })
          .then((detail) => {
            const own = detail.conversions
              .filter((conversion) => conversion.variantId === line.itemId)
              .map(({ uomCode, factorMilli }) => ({ uomCode, factorMilli }));
            patchLine(line.key, { conversions: own });
          })
          .catch(() => patchLine(line.key, { conversions: [] }));
      });
  }, [lines, patchLine]);
}
