import { Box, Button, Dialog, Flex } from "@radix-ui/themes";
import { StatusMessage } from "../../../../../shared/components/StatusMessage/StatusMessage";
import { fillText } from "../../../../../shared/text/fillText";
import { uiText } from "../../../../../shared/text/strings";
import type { IRecoverDraftDialogProps } from "./types";

/** Offers the bill that was open when the app last closed; the cashier continues or discards it. */
export function RecoverDraftDialog({ draftForm, onDiscard, onContinue }: IRecoverDraftDialogProps) {
  const lineCount = draftForm.draft.lines.length;
  return (
    <Dialog.Root open>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>{uiText.bill.recoverTitle}</Dialog.Title>
        <Dialog.Description>{uiText.bill.recoverBody}</Dialog.Description>
        <Box mt="3">
          <StatusMessage role="neutral" label={uiText.status.draft}>
            {fillText(lineCount === 1 ? uiText.bill.draftLineOne : uiText.bill.draftLineOther, {
              count: lineCount,
            })}{" "}
            {draftForm.draft.lines.map((draftLine) => draftLine.name).join(", ")}
          </StatusMessage>
        </Box>
        <Flex gap="3" mt="4" justify="end">
          <Button variant="soft" color="gray" size="3" onClick={onDiscard}>
            {uiText.bill.discard}
          </Button>
          <Button size="3" autoFocus onClick={onContinue}>
            {uiText.bill.recover}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
