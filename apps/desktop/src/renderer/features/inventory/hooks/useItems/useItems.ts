import { useCallback, useEffect, useState } from "react";
import type { Item } from "@shopos/core";
import { call } from "../../../../shared/api/api";
import type { IItemFilter } from "./types";

/** Item list with filters; reload() after any change. */
export function useItems(filter: IItemFilter, limit = 200) {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    call("items.list", {
      query: filter.query || undefined,
      includeInactive: filter.includeInactive,
      needsCorrection: filter.needsCorrection,
      limit,
      offset: 0,
    })
      .then((listResult) => {
        if (live) {
          setItems(listResult.items);
          setTotal(listResult.total);
        }
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [filter.query, filter.includeInactive, filter.needsCorrection, limit, tick]);
  const reload = useCallback(() => setTick((previousTick) => previousTick + 1), []);
  return { items, total, loading, reload };
}
