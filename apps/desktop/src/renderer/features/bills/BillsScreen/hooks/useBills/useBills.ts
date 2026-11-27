import { useEffect, useState } from "react";
import type { Bill } from "@shopos/core";
import { call, messageOf } from "../../../../../shared/api/api";
import { BILLS_PAGE_LIMIT } from "../../constants";
import type { IBillFilter } from "../../types";
import type { IUseBillsResult } from "./types";

/** The newest bills that match the filter. A slow answer for an old filter never replaces a newer one. */
export function useBills(filter: IBillFilter): IUseBillsResult {
  const [bills, setBills] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let isCurrent = true;
    // A failed search must not leave the previous search's bills on screen under the new filter.
    const showFailure = (caughtError: unknown) => {
      setBills([]);
      setTotal(0);
      setError(messageOf(caughtError));
    };
    setLoading(true);
    call("bills.list", {
      number: filter.number || undefined,
      from: filter.from || undefined,
      to: filter.to || undefined,
      customer: filter.customer || undefined,
      limit: BILLS_PAGE_LIMIT,
      offset: 0,
    })
      .then((listResult) => {
        if (!isCurrent) return;
        setBills(listResult.bills);
        setTotal(listResult.total);
        setError(null);
      })
      .catch((caughtError) => isCurrent && showFailure(caughtError))
      .finally(() => isCurrent && setLoading(false));
    return () => {
      isCurrent = false;
    };
  }, [filter.number, filter.from, filter.to, filter.customer]);
  return { bills, total, loading, error };
}
