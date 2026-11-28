import { Checkbox, Flex, Grid, Text, TextField } from "@radix-ui/themes";
import { AXIS_KEYS } from "@shopos/core";
import { StatusMessage } from "../../../../../shared/components/StatusMessage";
import { fillText } from "../../../../../shared/text/fillText";
import { uiText } from "../../../../../shared/text/strings";
import type { IAxisPickerProps } from "./types";

const attributeName = (key: string) =>
  uiText.family.attributeNames[key as keyof typeof uiText.family.attributeNames] ?? key;

/** Tick up to 4 attributes; each ticked one gets a field for its comma-separated values. */
export function AxisPicker({
  axisKeys,
  axisValuesText,
  axisLimitReason,
  onToggle,
  onValuesChange,
}: IAxisPickerProps) {
  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="bold">
        {uiText.family.attributes}
      </Text>
      <Grid columns="3" gap="2">
        {AXIS_KEYS.map((key) => (
          <Text as="label" size="2" key={key}>
            <Flex gap="2" align="center">
              <Checkbox checked={axisKeys.includes(key)} onCheckedChange={() => onToggle(key)} />
              {attributeName(key)}
            </Flex>
          </Text>
        ))}
      </Grid>
      {axisLimitReason && (
        <StatusMessage role="neutral" label={uiText.family.limitLabel}>
          {axisLimitReason}
        </StatusMessage>
      )}
      {axisKeys.map((key) => (
        <TextField.Root
          key={key}
          size="3"
          aria-label={fillText(uiText.family.values, { attribute: attributeName(key) })}
          placeholder={fillText(uiText.family.values, { attribute: attributeName(key) })}
          value={axisValuesText[key] ?? ""}
          onChange={(changeEvent) => onValuesChange(key, changeEvent.target.value)}
        />
      ))}
    </Flex>
  );
}
