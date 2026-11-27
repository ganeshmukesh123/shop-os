import { Button, Flex, Text } from "@radix-ui/themes";
import { StatusMessage } from "../../../../../../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../../../../../../shared/text/strings";
import type { IOpenBillPendingProps } from "./types";

/** While the bill loads, or why it could not be opened, with a way back to the list either way. */
export function OpenBillPending({ error, onBack }: IOpenBillPendingProps) {
  return (
    <Flex direction="column" gap="3" align="start">
      {error ? (
        <StatusMessage role="danger" label={uiText.status.error}>
          {error}
        </StatusMessage>
      ) : (
        <Text color="gray">{uiText.common.loading}…</Text>
      )}
      <Button size="3" variant="soft" onClick={onBack}>
        {uiText.bills.back}
      </Button>
    </Flex>
  );
}
