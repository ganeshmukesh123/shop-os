import { useState } from "react";
import { Flex } from "@radix-ui/themes";
import type { PrintTarget } from "@shopos/core";
import { LAYOUT } from "../../../shared/constants/layout";
import { StatusMessage } from "../../../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../../../shared/text/strings";
import { BillActions } from "./components/BillActions";
import { BillHeader } from "./components/BillHeader";
import { BillLinesTable } from "./components/BillLinesTable";
import { BillTotals } from "./components/BillTotals";
import type { IBillViewProps } from "./types";
import { useBillActions } from "./useBillActions";

/**
 * The saved bill, with Print / Save PDF and "New bill". Printing happens after the bill is committed.
 * Opened from the Bills screen (`onBack`), the last button goes back to the list instead.
 */
export function BillView({
  bill,
  lines,
  negativeStockItems,
  onNew,
  onBack,
  onCancel,
}: IBillViewProps) {
  const [target, setTarget] = useState<PrintTarget>("receipt");
  const { busy, actionError, print, pdf } = useBillActions(bill, target);
  const isOpenedFromList = onBack !== undefined;
  const canCancel = onCancel !== undefined && bill.status === "posted";
  return (
    <Flex direction="column" gap="3" maxWidth={LAYOUT.pageMedium}>
      <BillHeader
        bill={bill}
        negativeStockItems={negativeStockItems}
        isOpenedFromList={isOpenedFromList}
      />
      <BillLinesTable lines={lines} />
      <BillTotals bill={bill} />
      <BillActions
        target={target}
        onTargetChange={setTarget}
        busy={busy}
        onPrint={() => void print()}
        onPdf={() => void pdf()}
        leaveLabel={isOpenedFromList ? uiText.bills.back : uiText.bill.newBill}
        onLeave={onBack ?? onNew}
        onCancel={canCancel ? onCancel : undefined}
      />
      {actionError && (
        <StatusMessage role="danger" label={uiText.status.error}>
          {actionError}
        </StatusMessage>
      )}
    </Flex>
  );
}
