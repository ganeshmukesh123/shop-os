import { Flex, RadioGroup, Text, TextField } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import type { ISurvivorPickerProps } from "./types";

/** Search for the item to keep and choose it (spec 002 T051). Pure: the hook does the search. */
export function SurvivorPicker({
  query,
  matches,
  survivorId,
  onQuery,
  onChoose,
}: ISurvivorPickerProps) {
  const text = uiText.merge;
  return (
    <Flex direction="column" gap="2">
      <Text as="label" size="2" weight="medium">
        {text.findSurvivor}
        <TextField.Root
          mt="1"
          size="3"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
      </Text>
      {query !== "" && matches.length === 0 && <Text color="gray">{text.noMatches}</Text>}
      {matches.length > 0 && (
        <RadioGroup.Root
          aria-label={text.survivorLabel}
          value={survivorId}
          onValueChange={onChoose}
        >
          {matches.map((match) => (
            <RadioGroup.Item key={match.id} value={match.id}>
              {match.name}
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      )}
    </Flex>
  );
}
