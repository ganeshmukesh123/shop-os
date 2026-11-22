import { useEffect, useState } from "react";
import type { ClockWarning } from "@shopos/core";
import { call } from "../../shared/api/api";

/**
 * Asks the main process whether the clock or the time zone looks wrong. It checks again whenever
 * `refreshKey` changes (for example the screen), so a fixed setting clears the warning. A failed check
 * shows nothing: it must never get in the way of billing.
 */
export function useClockWarnings(refreshKey: string): ClockWarning[] {
  const [warnings, setWarnings] = useState<ClockWarning[]>([]);

  useEffect(() => {
    let isCurrent = true;
    const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    call("settings.clockCheck", { deviceTimeZone })
      .then((checkResult) => isCurrent && setWarnings(checkResult.warnings))
      .catch(() => isCurrent && setWarnings([]));
    return () => {
      isCurrent = false;
    };
  }, [refreshKey]);

  return warnings;
}
