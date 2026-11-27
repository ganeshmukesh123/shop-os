import { AlertDialog, Button, Flex, Text, TextField } from "@radix-ui/themes";
import { LAYOUT } from "../../../../../shared/constants/layout";
import { StatusMessage } from "../../../../../shared/components/StatusMessage/StatusMessage";
import { fillText } from "../../../../../shared/text/fillText";
import { uiText } from "../../../../../shared/text/strings";
import { CANCEL_REASON_MAX_LENGTH } from "./constants";
import type { ICancelBillDialogProps } from "./types";
import { useCancelBill } from "./useCancelBill";

/** Asks why a bill is cancelled (required, FR-017) and says what cancelling does before it is done. */
export function CancelBillDialog({ bill, onClose, onCancelled }: ICancelBillDialogProps) {
  const text = uiText.bills.cancel;
  const { reason, setReason, isBusy, errorMessage, canCancel, cancelBill } = useCancelBill(
    bill.id,
    onCancelled,
  );
  return (
    <AlertDialog.Root open onOpenChange={(isNowOpen) => !isNowOpen && !isBusy && onClose()}>
      <AlertDialog.Content maxWidth={LAYOUT.cancelDialogWidth}>
        <AlertDialog.Title>{fillText(text.title, { number: bill.number })}</AlertDialog.Title>
        <AlertDialog.Description size="2">{text.effect}</AlertDialog.Description>
        <Flex direction="column" gap="1" mt="3">
          <Text as="label" htmlFor="cancel-reason" size="2" weight="bold">
            {text.reason}
          </Text>
          <TextField.Root
            id="cancel-reason"
            size="3"
            autoFocus
            maxLength={CANCEL_REASON_MAX_LENGTH}
            disabled={isBusy}
            value={reason}
            onChange={(changeEvent) => setReason(changeEvent.target.value)}
          />
        </Flex>
        {errorMessage && (
          <Flex mt="3">
            <StatusMessage role="danger" label={uiText.status.error}>
              {errorMessage}
            </StatusMessage>
          </Flex>
        )}
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button size="3" variant="soft" color="gray" disabled={isBusy}>
              {text.keep}
            </Button>
          </AlertDialog.Cancel>
          <Button
            size="3"
            color="red"
            loading={isBusy}
            disabled={!canCancel}
            onClick={() => void cancelBill()}
          >
            {text.confirm}
          </Button>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
