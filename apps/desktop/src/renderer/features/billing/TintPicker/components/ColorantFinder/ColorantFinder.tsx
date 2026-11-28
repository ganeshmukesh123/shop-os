import { Button, Flex } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import { LabelledField } from "../LabelledField";
import type { IColorantFinderProps } from "./types";

/** Type a colorant's name and add it to the shade (T064). */
export function ColorantFinder({ form }: IColorantFinderProps) {
  const text = uiText.bill.tintPicker.custom;
  const unused = form.search.matches.filter(
    (match) => !form.draft.colorants.some((colorant) => colorant.item.id === match.id),
  );
  return (
    <Flex direction="column" gap="2">
      <LabelledField
        label={text.findColorant}
        value={form.search.query}
        onChange={(query) => void form.search.setQuery(query)}
      />
      <Flex gap="2" wrap="wrap">
        {unused.map((match) => (
          <Button
            key={match.id}
            size="2"
            variant="soft"
            aria-label={`${text.addColorant}: ${match.name}`}
            onClick={() => form.addColorant(match)}
          >
            {`${text.addColorant} ${match.name}`}
          </Button>
        ))}
      </Flex>
    </Flex>
  );
}
