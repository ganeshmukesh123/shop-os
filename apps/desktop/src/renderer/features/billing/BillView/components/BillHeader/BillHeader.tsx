import { Flex, Heading, Text } from "@radix-ui/themes";
import { formatQuantity } from "@shopos/core";
import { StatusBadge } from "../../../../../shared/components/StatusBadge/StatusBadge";
import { StatusMessage } from "../../../../../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../../../../../shared/text/strings";
import { CancelledBanner } from "../CancelledBanner";
import type { IBillHeaderProps } from "./types";

/** The bill's number, date, payment and customer, and any warning about it (cancelled, stock). */
export function BillHeader({ bill, negativeStockItems, isOpenedFromList }: IBillHeaderProps) {
  const isCancelled = bill.status === "cancelled";
  return (
    <>
      <Flex align="center" gap="3">
        <Heading size="6">
          {isOpenedFromList ? uiText.bill.opened : uiText.bill.saved}: {bill.number}
        </Heading>
        {isCancelled && <StatusBadge role="danger" label={uiText.status.cancelled} size="3" />}
      </Flex>
      <Text color="gray">
        {bill.billDate.replace("T", " ").slice(0, 16)} · {uiText.payment[bill.paymentMode]}
        {bill.customerName ? ` · ${bill.customerName}` : ""}
      </Text>
      {isCancelled && (
        <CancelledBanner cancelReason={bill.cancelReason} cancelledAt={bill.cancelledAt} />
      )}
      {negativeStockItems.length > 0 && (
        <StatusMessage role="warning" label={uiText.status.negativeStock}>
          {uiText.bill.negativeWarn}{" "}
          {negativeStockItems
            .map((item) => `${item.name} (${formatQuantity(item.stockMilli)} ${item.unit})`)
            .join(", ")}
          . Correct stock from the Items screen.
        </StatusMessage>
      )}
    </>
  );
}
