import { Button, Flex } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import { PrintTargetSelect } from "../PrintTargetSelect";
import type { IBillActionsProps } from "./types";

/** Print to (receipt, A5, A4), Print, Save PDF, the way out, and Cancel bill when it is offered. */
export function BillActions({
  target,
  onTargetChange,
  busy,
  onPrint,
  onPdf,
  leaveLabel,
  onLeave,
  onCancel,
}: IBillActionsProps) {
  return (
    <Flex gap="3" align="center" wrap="wrap">
      <PrintTargetSelect target={target} onTargetChange={onTargetChange} />
      <Button size="3" onClick={onPrint} loading={busy === "print"} autoFocus>
        {uiText.bill.print}
      </Button>
      <Button size="3" variant="soft" onClick={onPdf} loading={busy === "pdf"}>
        {uiText.bill.pdf}
      </Button>
      <Button size="3" variant="outline" onClick={onLeave}>
        {leaveLabel}
      </Button>
      {onCancel && (
        <Button size="3" variant="soft" color="red" onClick={onCancel}>
          {uiText.bills.cancel.open}
        </Button>
      )}
    </Flex>
  );
}
