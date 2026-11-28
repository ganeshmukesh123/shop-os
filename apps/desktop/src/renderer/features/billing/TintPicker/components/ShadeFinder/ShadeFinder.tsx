import { Flex, Text, TextField } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import { ChoiceList } from "../ChoiceList";
import type { IShadeFinderProps } from "./types";

/** Type part of a shade's name or code and pick it (spec 002 T064). */
export function ShadeFinder({ query, shades, shadeId, onQuery, onChoose }: IShadeFinderProps) {
  const text = uiText.bill.tintPicker;
  return (
    <Flex direction="column" gap="2">
      <Text as="label" size="2" weight="medium">
        {text.findShade}
        <TextField.Root
          mt="1"
          size="3"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
      </Text>
      <ChoiceList
        label={text.shades}
        choices={shades.map((shade) => ({
          id: shade.id,
          label: `${shade.shadeName} (${shade.shadeCode})`,
        }))}
        value={shadeId}
        emptyText={query ? text.noShades : undefined}
        onChoose={onChoose}
      />
    </Flex>
  );
}
