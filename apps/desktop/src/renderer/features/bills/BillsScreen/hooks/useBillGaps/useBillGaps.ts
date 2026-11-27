import { useEffect, useState } from "react";
import type { IRecordedNumberGap } from "@shopos/core";
import { call, messageOf } from "../../../../../shared/api/api";
import type { IUseBillGapsResult } from "./types";

/** The bill numbers a restore lost (bills.gaps), read again when `refreshCount` changes. */
export function useBillGaps(refreshCount = 0): IUseBillGapsResult {
  const [gaps, setGaps] = useState<IRecordedNumberGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    call("bills.gaps", {})
      .then((gapsResult) => {
        if (!isCurrent) return;
        setGaps(gapsResult.gaps);
        setError(null);
      })
      .catch((caughtError) => isCurrent && setError(messageOf(caughtError)))
      .finally(() => isCurrent && setLoading(false));
    return () => {
      isCurrent = false;
    };
  }, [refreshCount]);
  return { gaps, loading, error };
}
