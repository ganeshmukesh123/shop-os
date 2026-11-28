import { Button, Flex, Text } from "@radix-ui/themes";
import { uiText } from "../../../shared/text/strings";
import { useRepeatShades } from "./hooks/useRepeatShades";
import { entryText, whenText } from "./repeatPick";
import type { IRepeatShadesProps } from "./types";

/** "Same as last time": the customer's shades, newest first; one tap adds the mix (T065). */
export function RepeatShades({ customerName, onAdd }: IRepeatShadesProps) {
  const { repeats, add } = useRepeatShades(customerName, onAdd);
  if (repeats.length === 0) return null;
  return (
    <Flex direction="column" gap="2">
      <Text weight="bold">{uiText.bill.repeat.title}</Text>
      <Flex gap="2" wrap="wrap">
        {repeats.map((repeat) => (
          <Button
            key={`${repeat.shade.id}-${repeat.baseVariant.id}`}
            size="3"
            variant="soft"
            onClick={() => void add(repeat)}
          >
            {entryText(repeat)} ({whenText(repeat)})
          </Button>
        ))}
      </Flex>
    </Flex>
  );
}
