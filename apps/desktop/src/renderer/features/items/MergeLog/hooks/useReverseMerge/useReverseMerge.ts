import { useState } from "react";
import { call, messageOf } from "../../../../../shared/api/api";
import { uiText } from "../../../../../shared/text/strings";

/** Reverse one merge: Reverse opens a reason box on its row, Confirm sends it (spec 002 T051). */
export function useReverseMerge(onReversed: () => void) {
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const start = (mergeLogId: string) => {
    setReversingId(mergeLogId);
    setReason("");
    setError(null);
  };

  const confirm = async () => {
    if (!reversingId) return;
    if (reason.trim() === "") return setError(uiText.mergeLog.reasonRequired);
    try {
      await call("items.merge.reverse", { mergeLogId: reversingId, reason: reason.trim() });
      setReversingId(null);
      onReversed();
    } catch (caughtError) {
      setError(messageOf(caughtError));
    }
  };

  return { reversingId, reason, setReason, error, start, confirm };
}
