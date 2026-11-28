import { Button, Flex, Text } from "@radix-ui/themes";
import { StatusMessage } from "../../../../../shared/components/StatusMessage";
import { uiText } from "../../../../../shared/text/strings";
import type { IDuplicateWarningProps } from "./types";

/**
 * Items that look like the family being saved, each with why (spec 002 T050): open one of them
 * instead, or save anyway.
 */
export function DuplicateWarning({
  duplicates,
  onSaveAnyway,
  onOpenExisting,
}: IDuplicateWarningProps) {
  const text = uiText.family.duplicates;
  return (
    <StatusMessage role="warning" label={text.label}>
      <Flex direction="column" gap="2">
        <Text>{text.intro}</Text>
        {duplicates.map((duplicate) => (
          <Flex key={duplicate.variantId} gap="3" align="center" justify="between" wrap="wrap">
            <Text weight="medium">
              {duplicate.displayName} ({text.reasons[duplicate.reason]})
            </Text>
            {onOpenExisting && (
              <Button
                size="2"
                variant="soft"
                aria-label={`${text.openExisting}: ${duplicate.displayName}`}
                onClick={() => onOpenExisting(duplicate)}
              >
                {text.openExisting}
              </Button>
            )}
          </Flex>
        ))}
        <Flex>
          <Button size="3" color="amber" onClick={onSaveAnyway}>
            {text.saveAnyway}
          </Button>
        </Flex>
      </Flex>
    </StatusMessage>
  );
}
