import { Button, Flex, Text } from "@radix-ui/themes";
import { formatQuantity } from "@shopos/core";
import { uiText } from "../../../../../shared/text/strings";
import { amountText, priceText } from "../../tintPick";
import type { IMixPanelProps } from "./types";

/** The colorants for one can, large enough for the tinter to read, the price and Add (T064). */
export function MixPanel({ resolved, onAdd }: IMixPanelProps) {
  const text = uiText.bill.tintPicker;
  return (
    <Flex direction="column" gap="3">
      <Text weight="bold">{text.mix}</Text>
      {resolved.lines.map((line) => (
        <Flex key={line.colorantVariantId} justify="between" align="baseline">
          <Text size="6" weight="bold">{`${line.name} ${amountText(line.qtyMilli)}`}</Text>
          <Text size="2" color="gray">
            {text.inStock.replace("{stock}", formatQuantity(line.stockMilli))}
          </Text>
        </Flex>
      ))}
      <Text size="4">{priceText(resolved)}</Text>
      <Flex justify="end">
        <Button size="3" onClick={onAdd}>
          {text.add}
        </Button>
      </Flex>
    </Flex>
  );
}
