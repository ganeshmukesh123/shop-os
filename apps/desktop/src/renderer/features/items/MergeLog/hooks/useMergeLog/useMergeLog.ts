import { useEffect, useState } from "react";
import type { IMergeListRow } from "@shopos/core";
import { call, messageOf } from "../../../../../shared/api/api";
import { MERGE_LOG_LIMIT } from "../../constants";

/** The latest merges, loaded when the log opens and again after a reversal (spec 002 T051). */
export function useMergeLog() {
  const [merges, setMerges] = useState<IMergeListRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setMerges((await call("items.merge.list", { limit: MERGE_LOG_LIMIT, offset: 0 })).merges);
    } catch (caughtError) {
      setError(messageOf(caughtError));
    }
  };

  // Read the log from main once, when the dialog mounts
  useEffect(() => {
    void load();
  }, []);

  return { merges, error, load };
}
