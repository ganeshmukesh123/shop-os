import { Flex, Text, TextArea } from "@radix-ui/themes";
import { StatusMessage } from "../../../../../shared/components/StatusMessage";
import { uiText } from "../../../../../shared/text/strings";
import type { IReasonFieldProps } from "./types";

/** The required reason for a merge, and what went wrong if anything did (spec 002 T051). */
export function ReasonField({ reason, error, onReason }: IReasonFieldProps) {
  const text = uiText.merge;
  return (
    <Flex direction="column" gap="3">
      <Text as="label" size="2" weight="medium">
        {text.reason}
        <TextArea mt="1" value={reason} onChange={(event) => onReason(event.target.value)} />
      </Text>
      {error && (
        <StatusMessage role="danger" label={text.errorLabel}>
          {error}
        </StatusMessage>
      )}
    </Flex>
  );
}
