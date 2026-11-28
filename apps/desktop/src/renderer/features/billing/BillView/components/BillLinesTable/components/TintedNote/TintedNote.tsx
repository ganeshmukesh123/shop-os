import { Flex, Text } from "@radix-ui/themes";
import { tintMixText } from "@shopos/core";
import { StatusBadge } from "../../../../../../../shared/components/StatusBadge";
import { uiText } from "../../../../../../../shared/text/strings";
import type { ITintedNoteProps } from "./types";

/** Under a tinted can: what was mixed per can, and a badge that it cannot be returned (T067). */
export function TintedNote({ colorants }: ITintedNoteProps) {
  const text = uiText.bill.tint;
  return (
    <Flex direction="column" gap="1" mt="1">
      <Text size="2" color="gray">
        {text.perCan.replace("{mix}", tintMixText(colorants))}
      </Text>
      <StatusBadge role="neutral" label={text.nonReturnable} />
    </Flex>
  );
}
