import { useEffect, useState } from "react";
import { call, messageOf } from "../../../../../shared/api/api";
import type { IUseOpenBillResult } from "./types";

/** Reads one saved bill and its lines (bills.get). `error` is set when it cannot be read. */
export function useOpenBill(billId: string): IUseOpenBillResult {
  const [opened, setOpened] = useState<IUseOpenBillResult["opened"]>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let isCurrent = true;
    setOpened(null);
    setError(null);
    call("bills.get", { id: billId })
      .then((getResult) => isCurrent && setOpened(getResult))
      .catch((caughtError) => isCurrent && setError(messageOf(caughtError)));
    return () => {
      isCurrent = false;
    };
  }, [billId]);
  return { opened, error };
}
