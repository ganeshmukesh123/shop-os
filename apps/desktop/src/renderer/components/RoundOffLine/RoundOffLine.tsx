import { Text } from "@radix-ui/themes";
import { formatSignedRupees } from "@shopos/core";
import { uiText } from "../../strings";
import type { IRoundOffLineProps } from "./RoundOffLine.types";

/** The signed round-off between the bill discount and the grand total; nothing when it is zero (FR-010a). */
export function RoundOffLine({ roundOffPaise }: IRoundOffLineProps) {
  const hasRoundOff = roundOffPaise !== 0;
  return (
    hasRoundOff && (
      <Text>
        {uiText.bill.roundOff}: {formatSignedRupees(roundOffPaise)}
      </Text>
    )
  );
}
