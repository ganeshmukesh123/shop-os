import { useEffect, useState } from "react";
import { AlertDialog, Button, Flex, Text, TextField } from "@radix-ui/themes";
import { LAYOUT } from "../../layout";
import { StatusMessage } from "../../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../../strings";
import { LAST_BILL_MAX_LENGTH } from "./RestoreBackupDialog.constants";
import type { IRestoreBackupDialogProps } from "./RestoreBackupDialog.types";
import { fillText } from "./restoreMessages";

/**
 * Asks for the last bill number the owner printed before a restore replaces the data, so the counter
 * never hands out a number that is already on a customer's paper (FR-013b, EC-19, research D21).
 */
export function RestoreBackupDialog({
  isOpen,
  backupFileName,
  example,
  errorMessage,
  isBusy,
  onRestore,
  onCancel,
}: IRestoreBackupDialogProps) {
  const text = uiText.restore;
  const [typedNumber, setTypedNumber] = useState("");
  useEffect(() => {
    if (!isOpen) setTypedNumber("");
  }, [isOpen]);

  return (
    <AlertDialog.Root
      open={isOpen}
      onOpenChange={(isNowOpen) => !isNowOpen && !isBusy && onCancel()}
    >
      <AlertDialog.Content maxWidth={LAYOUT.restoreDialogWidth}>
        <AlertDialog.Title>{text.title}</AlertDialog.Title>
        <AlertDialog.Description size="2">{text.warning}</AlertDialog.Description>
        <Text as="div" size="2" mt="3">
          {text.file}: <b>{backupFileName}</b>
        </Text>
        <Flex direction="column" gap="2" mt="3">
          <Text as="div" size="2" weight="bold">
            <label htmlFor="restore-last-bill">{text.lastBill}</label>
          </Text>
          <TextField.Root
            id="restore-last-bill"
            aria-describedby="restore-last-bill-help"
            size="3"
            maxLength={LAST_BILL_MAX_LENGTH}
            placeholder={example}
            value={typedNumber}
            onChange={(changeEvent) => setTypedNumber(changeEvent.target.value)}
          />
          <Text as="div" id="restore-last-bill-help" size="1" color="gray">
            {fillText(text.lastBillHelp, { example })}
          </Text>
          <Text as="div" size="1" color="gray">
            {text.cannotSay}
          </Text>
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
              {text.cancel}
            </Button>
          </AlertDialog.Cancel>
          <Button
            size="3"
            color="red"
            disabled={isBusy}
            onClick={() => void onRestore(typedNumber.trim())}
          >
            {isBusy ? text.busy : text.confirm}
          </Button>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
