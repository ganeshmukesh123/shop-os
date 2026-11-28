import { Flex, Text, TextField } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import { ColorantFinder } from "../ColorantFinder";
import type { IColorantLinesProps } from "./types";

/** The colorants chosen, each with its amount in ml for one can, and the finder to add more (T064). */
export function ColorantLines({ form }: IColorantLinesProps) {
  const text = uiText.bill.tintPicker.custom;
  const setAmount = (itemId: string, amountText: string) =>
    form.change({
      colorants: form.draft.colorants.map((colorant) =>
        colorant.item.id === itemId ? { ...colorant, amountText } : colorant,
      ),
    });
  return (
    <Flex direction="column" gap="2">
      {form.draft.colorants.map(({ item, amountText }) => (
        <Flex key={item.id} gap="3" align="center">
          <Text weight="medium">{item.name}</Text>
          <TextField.Root
            aria-label={text.amountFor.replace("{colorant}", item.name)}
            inputMode="decimal"
            value={amountText}
            onChange={(event) => setAmount(item.id, event.target.value)}
          />
        </Flex>
      ))}
      <ColorantFinder form={form} />
    </Flex>
  );
}
