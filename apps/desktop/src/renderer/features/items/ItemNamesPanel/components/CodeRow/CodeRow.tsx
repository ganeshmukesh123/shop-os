import { Button, Flex, Text } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import type { ICodeRowProps } from "./types";

/** One name or code, what it is, and Remove (T049). */
export function CodeRow({ value, detail, onRemove }: ICodeRowProps) {
  return (
    <Flex gap="3" align="center" justify="between">
      <Flex gap="3" align="baseline">
        <Text weight="medium">{value}</Text>
        <Text size="2" color="gray">
          {detail}
        </Text>
      </Flex>
      <Button
        size="1"
        variant="ghost"
        color="gray"
        aria-label={uiText.names.remove.replace("{value}", value)}
        onClick={onRemove}
      >
        {uiText.names.removeButton}
      </Button>
    </Flex>
  );
}
