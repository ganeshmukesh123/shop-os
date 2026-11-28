import { RadioGroup, Text } from "@radix-ui/themes";
import type { IChoiceListProps } from "./types";

/** A short list to pick one from: the shades found, or the product's cans (T064). */
export function ChoiceList({ label, choices, value, emptyText, onChoose }: IChoiceListProps) {
  if (choices.length === 0) return emptyText ? <Text color="gray">{emptyText}</Text> : null;
  return (
    <RadioGroup.Root aria-label={label} value={value} onValueChange={onChoose}>
      {choices.map((choice) => (
        <RadioGroup.Item key={choice.id} value={choice.id}>
          {choice.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
