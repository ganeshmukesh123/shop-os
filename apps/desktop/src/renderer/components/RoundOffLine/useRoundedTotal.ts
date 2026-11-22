import { useEffect, useState } from "react";
import { roundBillTotal, type IRoundedBillTotal } from "@shopos/core";
import { call } from "../../state/api";

/**
 * The grand total as the saved bill will have it: rounded to the rupee when the shop's setting is on
 * (FR-010a), so the counter shows the amount to collect. Until the setting has loaded, or if it cannot
 * be read, the exact total is shown with no round-off.
 */
export function useRoundedTotal(grandTotalPaise: number): IRoundedBillTotal {
  const [isRoundingOn, setIsRoundingOn] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    call("settings.get", {})
      .then((profile) => isCurrent && setIsRoundingOn(profile.roundBillTotal))
      .catch(() => isCurrent && setIsRoundingOn(false));
    return () => {
      isCurrent = false;
    };
  }, []);

  // An unfinished bill can total below zero (a discount larger than the lines); nothing is rounded then.
  const isRoundable = isRoundingOn && grandTotalPaise >= 0;
  return isRoundable
    ? roundBillTotal(grandTotalPaise, true)
    : { roundOffPaise: 0, roundedTotalPaise: grandTotalPaise };
}
