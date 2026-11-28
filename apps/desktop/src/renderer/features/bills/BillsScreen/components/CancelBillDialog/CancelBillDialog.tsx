import { AlertDialog, Flex } from "@radix-ui/themes";
import { LAYOUT } from "../../../../../shared/constants/layout";
import { StatusMessage } from "../../../../../shared/components/StatusMessage/StatusMessage";
import { fillText } from "../../../../../shared/text/fillText";
import { uiText } from "../../../../../shared/text/strings";
import { CancelDialogButtons } from "./CancelDialogButtons";
import { CancelReasonField } from "./CancelReasonField";
import type { ICancelBillDialogProps } from "./types";
import { useCancelBill } from "./useCancelBill";
import { useReturnFocus } from "./useReturnFocus";

/** Asks why a bill is cancelled (required, FR-017) and says what cancelling does before it is done. */
export function CancelBillDialog({ bill, onClose, onCancelled }: ICancelBillDialogProps) {
  const text = uiText.bills.cancel;
  const { reason, setReason, isBusy, errorMessage, canCancel, cancelBill } = useCancelBill(
    bill.id,
    onCancelled,
  );
  const returnFocus = useReturnFocus();
  return (
    <AlertDialog.Root open onOpenChange={(isNowOpen) => !isNowOpen && !isBusy && onClose()}>
      <AlertDialog.Content maxWidth={LAYOUT.cancelDialogWidth} onCloseAutoFocus={returnFocus}>
        <AlertDialog.Title>{fillText(text.title, { number: bill.number })}</AlertDialog.Title>
        <AlertDialog.Description size="2">{text.effect}</AlertDialog.Description>
        <CancelReasonField reason={reason} onChange={setReason} isDisabled={isBusy} />
        {errorMessage && (
          <Flex mt="3">
            <StatusMessage role="danger" label={uiText.status.error}>
              {errorMessage}
            </StatusMessage>
          </Flex>
        )}
        <CancelDialogButtons
          isBusy={isBusy}
          canCancel={canCancel}
          onConfirm={() => void cancelBill()}
        />
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
