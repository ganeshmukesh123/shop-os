import { AlertDialog, Button, Flex } from "@radix-ui/themes";
import { uiText } from "../../../../../../shared/text/strings";
import type { ICancelDialogButtonsProps } from "./types";

/** "Keep bill" closes the dialog; "Cancel bill" works only once a reason is typed. */
export function CancelDialogButtons({ isBusy, canCancel, onConfirm }: ICancelDialogButtonsProps) {
  const text = uiText.bills.cancel;
  return (
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
        disabled={isBusy || !canCancel}
        onClick={onConfirm}
      >
        {text.confirm}
      </Button>
    </Flex>
  );
}
