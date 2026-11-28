import { useEffect, useState } from "react";
import type { ExceptionStatus, IExceptionEvent } from "@shopos/core";
import { call, messageOf } from "../../../../../shared/api/api";

/** The open or resolved issues, read again whenever the tab changes (spec 002 T052). */
export function useDataIssues(status: ExceptionStatus) {
  const [events, setEvents] = useState<IExceptionEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setEvents((await call("exceptions.list", { status })).events);
    } catch (caughtError) {
      setError(messageOf(caughtError));
    }
  };

  // Read the chosen tab's issues from main
  useEffect(() => {
    void load();
  }, [status]);

  return { events, error, load };
}
