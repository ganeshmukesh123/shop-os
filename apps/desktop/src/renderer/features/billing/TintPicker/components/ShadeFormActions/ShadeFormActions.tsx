import { Button, Flex } from "@radix-ui/themes";
import { StatusMessage } from "../../../../../shared/components/StatusMessage";
import { uiText } from "../../../../../shared/text/strings";
import type { IShadeFormActionsProps } from "./types";

/** What went wrong, if anything, then Back and Save shade (T064). */
export function ShadeFormActions({ error, onCancel, onSave }: IShadeFormActionsProps) {
  const text = uiText.bill.tintPicker;
  return (
    <Flex direction="column" gap="3">
      {error && (
        <StatusMessage role="danger" label={text.errorLabel}>
          {error}
        </StatusMessage>
      )}
      <Flex gap="3" justify="end">
        <Button size="3" variant="soft" color="gray" onClick={onCancel}>
          {text.custom.cancel}
        </Button>
        <Button size="3" onClick={onSave}>
          {text.custom.save}
        </Button>
      </Flex>
    </Flex>
  );
}
