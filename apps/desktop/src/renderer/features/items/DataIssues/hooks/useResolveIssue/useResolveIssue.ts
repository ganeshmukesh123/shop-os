import { useState } from "react";
import { call, messageOf } from "../../../../../shared/api/api";
import { uiText } from "../../../../../shared/text/strings";

/** Resolve one issue: Resolve opens a note box on its row, Mark resolved sends it (T052). */
export function useResolveIssue(onResolved: () => void) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const start = (issueId: string) => {
    setResolvingId(issueId);
    setNote("");
    setError(null);
  };

  const confirm = async () => {
    if (!resolvingId) return;
    if (note.trim() === "") return setError(uiText.dataIssues.noteRequired);
    try {
      await call("exceptions.resolve", { id: resolvingId, note: note.trim() });
      setResolvingId(null);
      onResolved();
    } catch (caughtError) {
      setError(messageOf(caughtError));
    }
  };

  return { resolvingId, note, setNote, error, start, confirm };
}
