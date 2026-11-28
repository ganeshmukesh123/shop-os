import { useEffect, useState } from "react";
import type { IFamilyGrid } from "@shopos/core";
import { call, messageOf } from "../../../shared/api/api";

/** The family's grid (families.grid), or the reason it could not be read. */
export function useFamilyGrid(familyId: string) {
  const [grid, setGrid] = useState<IFamilyGrid | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let isCurrent = true;
    call("families.grid", { familyId })
      .then((loaded) => isCurrent && setGrid(loaded))
      .catch((caughtError) => isCurrent && setError(messageOf(caughtError)));
    return () => {
      isCurrent = false;
    };
  }, [familyId]);
  return { grid, error };
}
