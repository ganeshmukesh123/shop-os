import { Button, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { fillText } from "../../../../../shared/text/fillText";
import { uiText } from "../../../../../shared/text/strings";
import type { IConversionRowFieldsProps } from "../../types";
import { exampleOf } from "../../useUnitConversions";

/** One alternate unit: which unit, how much of the base unit it holds, and "1 roll = 90 metre". */
export function ConversionRowFields(props: IConversionRowFieldsProps) {
  const { row, baseUnit, unitOptions, onUnit, onHolds, onRemove } = props;
  const text = uiText.family.units;
  const unitName = row.uomCode || uiText.family.units.newUnit;
  const example = exampleOf(row, baseUnit);
  return (
    <Flex gap="3" align="center" wrap="wrap">
      <Select.Root value={row.uomCode || undefined} onValueChange={onUnit}>
        <Select.Trigger
          placeholder={text.unit}
          aria-label={fillText(text.unitFor, { unit: unitName })}
        />
        <Select.Content>
          {unitOptions.map((unit) => (
            <Select.Item key={unit.code} value={unit.code}>
              {unit.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      <TextField.Root
        inputMode="decimal"
        aria-label={fillText(text.holdsFor, { baseUnit, unit: unitName })}
        placeholder={fillText(text.holds, { baseUnit })}
        value={row.holdsText}
        onChange={(changeEvent) => onHolds(changeEvent.target.value)}
      />
      {example && <Text size="2">{example}</Text>}
      <Button
        variant="soft"
        color="gray"
        aria-label={fillText(text.removeUnit, { unit: unitName })}
        onClick={onRemove}
      >
        {text.remove}
      </Button>
    </Flex>
  );
}
