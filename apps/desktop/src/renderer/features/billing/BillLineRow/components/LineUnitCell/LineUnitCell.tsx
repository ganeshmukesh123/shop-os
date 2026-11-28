import { Flex, Select, Text } from "@radix-ui/themes";
import { formatQuantity } from "@shopos/core";
import { fillText } from "../../../../../shared/text/fillText";
import { uiText } from "../../../../../shared/text/strings";
import type { ILineUnitCellProps, IUnitSelectProps } from "./types";

/** The item's own unit first, then its other units; choosing its own unit clears the choice. */
function UnitSelect({ line, chosen, onChange }: IUnitSelectProps) {
  const unitCodes = [
    line.unit,
    ...(line.conversions ?? []).map((conversion) => conversion.uomCode),
  ];
  return (
    <Select.Root
      size="1"
      value={chosen}
      onValueChange={(uomCode) => onChange({ enteredUom: uomCode === line.unit ? null : uomCode })}
    >
      <Select.Trigger aria-label={fillText(uiText.bill.grid.unitFor, { item: line.name })} />
      <Select.Content>
        {unitCodes.map((uomCode) => (
          <Select.Item key={uomCode} value={uomCode}>
            {uomCode}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

/**
 * The line's unit: the item's own, or one of its other units (spec 002 T039). In another unit
 * the base quantity is shown beside it: "(180 metre)" for 2 rolls of 90 m.
 */
export function LineUnitCell({ line, result, onChange }: ILineUnitCellProps) {
  const chosen = line.enteredUom || line.unit;
  const showsBase = chosen !== line.unit && result.baseQtyMilli !== undefined;
  if ((line.conversions ?? []).length === 0) {
    return (
      <Text as="div" size="1" color="gray">
        {line.unit}
      </Text>
    );
  }
  return (
    <Flex gap="2" align="center">
      <UnitSelect line={line} chosen={chosen} onChange={onChange} />
      {showsBase && (
        <Text size="1" color="gray">
          {fillText(uiText.bill.grid.baseQuantity, {
            quantity: formatQuantity(result.baseQtyMilli!),
            unit: line.unit,
          })}
        </Text>
      )}
    </Flex>
  );
}
