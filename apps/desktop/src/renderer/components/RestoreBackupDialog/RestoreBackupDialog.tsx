import { AlertDialog, Button, Flex, Text, TextField } from "@radix-ui/themes";
import { LAYOUT } from "../../layout";
import { StatusMessage } from "../../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../../strings";
import { LAST_BILL_MAX_LENGTH } from "./RestoreBackupDialog.constants";
import type { IRestoreBackupDialogProps } from "./RestoreBackupDialog.types";
import { fillText } from "./restoreMessages";

/**
 * Asks for the last bill number the owner printed, shows what the restore will do to the bill numbers,
 * and only then replaces the data, so the counter never hands out a number that is already on a
 * customer's paper (FR-013b, EC-19, research D21).
 */
export function RestoreBackupDialog({
  isOpen,
  backupFileName,
  example,
  typedNumber,
  planText,
  errorMessage,
  isBusy,
  onTypedNumberChange,
  onCheck,
  onRestore,
  onCancel,
}: IRestoreBackupDialogProps) {
  const text = uiText.restore;
  const isPlanShown = planText !== null;
  // Busy with no plan shown is a check in progress; busy with a plan shown is the restore itself.
  const isChecking = isBusy && planText === null;
  const isRestoring = isBusy && isPlanShown;
  const canRestore = isPlanShown && isBusy === false;

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
          <Flex gap="2">
            <TextField.Root
              id="restore-last-bill"
              aria-describedby="restore-last-bill-help"
              size="3"
              maxLength={LAST_BILL_MAX_LENGTH}
              placeholder={example}
              value={typedNumber}
              onChange={(changeEvent) => onTypedNumberChange(changeEvent.target.value)}
            />
            <Button size="3" variant="soft" disabled={isBusy} onClick={() => void onCheck()}>
              {isChecking ? text.checking : text.check}
            </Button>
          </Flex>
          <Text as="div" id="restore-last-bill-help" size="1" color="gray">
            {fillText(text.lastBillHelp, { example })}
          </Text>
          <Text as="div" size="1" color="gray">
            {text.cannotSay}
          </Text>
        </Flex>
        {isPlanShown && (
          <Flex mt="3">
            <StatusMessage role="warning" label={text.planLabel}>
              {planText}
            </StatusMessage>
          </Flex>
        )}
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
            disabled={canRestore === false}
            onClick={() => void onRestore()}
          >
            {isRestoring ? text.busy : text.confirm}
          </Button>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
