import { Flex, Text, TextField } from "@radix-ui/themes";
import { uiText } from "../../../../../../shared/text/strings";
import { CANCEL_REASON_MAX_LENGTH } from "../constants";
import type { ICancelReasonFieldProps } from "./types";

/** The required "Reason" field, focused when the dialog opens. */
export function CancelReasonField({ reason, onChange, isDisabled }: ICancelReasonFieldProps) {
  return (
    <Flex direction="column" gap="1" mt="3">
      <Text as="label" htmlFor="cancel-reason" size="2" weight="bold">
        {uiText.bills.cancel.reason}
      </Text>
      <TextField.Root
        id="cancel-reason"
        size="3"
        autoFocus
        maxLength={CANCEL_REASON_MAX_LENGTH}
        disabled={isDisabled}
        value={reason}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
      />
    </Flex>
  );
}
