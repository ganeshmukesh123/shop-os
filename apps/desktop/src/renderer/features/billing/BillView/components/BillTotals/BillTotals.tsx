import { Flex, Text } from "@radix-ui/themes";
import { formatRupees } from "@shopos/core";
import { uiText } from "../../../../../shared/text/strings";
import { RoundOffLine } from "../../../RoundOffLine/RoundOffLine";
import type { IBillTotalsProps } from "./types";

/** Lines total, bill discount, round-off and the grand total the customer pays. */
export function BillTotals({ bill }: IBillTotalsProps) {
  return (
    <Flex direction="column" align="end" gap="1">
      <Text>
        {uiText.bill.total}: {formatRupees(bill.linesTotalPaise)}
      </Text>
      {bill.billDiscountPaise > 0 && (
        <Text>
          {uiText.bill.billDiscount}: -{formatRupees(bill.billDiscountPaise)}
        </Text>
      )}
      <RoundOffLine roundOffPaise={bill.roundOffPaise} />
      <Text size="6" weight="bold">
        {uiText.bill.grandTotal}: {formatRupees(bill.grandTotalPaise)}
      </Text>
    </Flex>
  );
}
