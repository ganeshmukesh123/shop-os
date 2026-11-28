import { Flex, Text } from "@radix-ui/themes";
import { formatQuantity } from "@shopos/core";
import { uiText } from "../../../../../shared/text/strings";
import type { IMergePreviewProps } from "./types";

/** What a merge will do, in the shop's words, before it is done (spec 002 T051). */
export function MergePreview({ merged, survivor }: IMergePreviewProps) {
  const text = uiText.merge;
  const moves = text.moves
    .replace("{quantity}", formatQuantity(merged.stockMilli))
    .replaceAll("{unit}", survivor.unit)
    .replace("{survivor}", survivor.name)
    .replace("{total}", formatQuantity(survivor.stockMilli + merged.stockMilli));
  return (
    <Flex direction="column" gap="1">
      <Text>{moves}</Text>
      <Text color="gray">{text.billsStay.replace("{item}", merged.name)}</Text>
    </Flex>
  );
}
