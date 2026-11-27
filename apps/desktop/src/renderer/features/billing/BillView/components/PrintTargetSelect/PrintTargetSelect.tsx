import { Select, Text } from "@radix-ui/themes";
import type { PrintTarget } from "@shopos/core";
import { uiText } from "../../../../../shared/text/strings";
import type { IPrintTargetSelectProps } from "./types";

/** "Print to": receipt, A5 or A4, used by both Print and Save PDF. */
export function PrintTargetSelect({ target, onTargetChange }: IPrintTargetSelectProps) {
  return (
    <>
      <Text size="2" weight="bold" id="print-as">
        {uiText.bill.printTo}
      </Text>
      <Select.Root
        value={target}
        onValueChange={(selectedTarget) => onTargetChange(selectedTarget as PrintTarget)}
      >
        <Select.Trigger aria-labelledby="print-as" />
        <Select.Content>
          <Select.Item value="receipt">{uiText.bill.receipt}</Select.Item>
          <Select.Item value="a5">A5</Select.Item>
          <Select.Item value="a4">A4</Select.Item>
        </Select.Content>
      </Select.Root>
    </>
  );
}
