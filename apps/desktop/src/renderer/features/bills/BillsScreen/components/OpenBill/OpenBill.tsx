import { useState } from "react";
import { Button, Flex, Text } from "@radix-ui/themes";
import type { Bill } from "@shopos/core";
import { StatusMessage } from "../../../../../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../../../../../shared/text/strings";
import { BillView } from "../../../../billing/BillView";
import { useOpenBill } from "../../hooks/useOpenBill";
import { CancelBillDialog } from "../CancelBillDialog";
import type { IOpenBillProps } from "./types";

/**
 * One past bill in the same bill view the cashier saw when saving it, with a way back to the list
 * and, while it is posted, a way to cancel it.
 */
export function OpenBill({ billId, onBack }: IOpenBillProps) {
  const { opened, error } = useOpenBill(billId);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelledBill, setCancelledBill] = useState<Bill | null>(null);
  if (opened) {
    const shownBill = cancelledBill ?? opened.bill;
    return (
      <>
        <BillView
          bill={shownBill}
          lines={opened.lines}
          negativeStockItems={[]}
          onBack={onBack}
          onCancel={() => setIsCancelling(true)}
        />
        {isCancelling && (
          <CancelBillDialog
            bill={shownBill}
            onClose={() => setIsCancelling(false)}
            onCancelled={(savedBill) => {
              setCancelledBill(savedBill);
              setIsCancelling(false);
            }}
          />
        )}
      </>
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
