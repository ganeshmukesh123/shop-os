import { Button, Flex, Text } from "@radix-ui/themes";
import { StatusMessage } from "../../../../../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../../../../../shared/text/strings";
import { BillView } from "../../../../billing/BillView";
import { useOpenBill } from "../../hooks/useOpenBill";
import type { IOpenBillProps } from "./types";

/** One past bill in the same bill view the cashier saw when saving it, with a way back to the list. */
export function OpenBill({ billId, onBack }: IOpenBillProps) {
  const { opened, error } = useOpenBill(billId);
  if (opened) {
    return (
      <BillView bill={opened.bill} lines={opened.lines} negativeStockItems={[]} onBack={onBack} />
    );
  }
  return (
    <Flex direction="column" gap="3" align="start">
      {error ? (
        <StatusMessage role="danger" label={uiText.status.error}>
          {error}
        </StatusMessage>
      ) : (
        <Text color="gray">{uiText.common.loading}…</Text>
      )}
      <Button size="3" variant="soft" onClick={onBack}>
        {uiText.bills.back}
      </Button>
    </Flex>
  );
}
