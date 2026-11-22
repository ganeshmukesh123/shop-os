import { Box, Checkbox, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { UNITS } from "@shopos/core";
import { uiText } from "../../../../../shared/text/strings";
import { CUSTOM_UNIT_OPTION } from "../../constants";
import type { IItemUnitFieldsProps } from "./types";

/** The unit list, the custom unit name, and whether decimal quantities are allowed. */
export function ItemUnitFields({ fields }: IItemUnitFieldsProps) {
  const isCustomUnit = fields.unitChoice === CUSTOM_UNIT_OPTION;
  return (
    <>
      <Flex gap="3">
        <Box flexGrow="1" asChild>
          <label>
            <Text as="div" size="2" weight="bold" mb="1">
              {uiText.form.unit} *
            </Text>
            <Select.Root value={fields.unitChoice} onValueChange={fields.chooseUnit}>
              <Select.Trigger className="shopos-full-width" aria-label={uiText.form.unit} />
              <Select.Content>
                {UNITS.map((unitOption) => (
                  <Select.Item key={unitOption} value={unitOption}>
                    {unitOption}
                  </Select.Item>
                ))}
                <Select.Item value={CUSTOM_UNIT_OPTION}>{uiText.form.customUnitOption}</Select.Item>
              </Select.Content>
            </Select.Root>
          </label>
        </Box>
        {isCustomUnit && (
          <Box flexGrow="1" asChild>
            <label>
              <Text as="div" size="2" weight="bold" mb="1">
                {uiText.form.customUnit}
              </Text>
              <TextField.Root
                size="3"
                maxLength={20}
                value={fields.customUnit}
                onChange={(changeEvent) => fields.setCustomUnit(changeEvent.target.value)}
              />
            </label>
          </Box>
        )}
      </Flex>
      <Text as="label" size="2">
        <Flex gap="2" align="center">
          <Checkbox
            checked={fields.allowsDecimal}
            disabled={fields.isEditing || !isCustomUnit}
            onCheckedChange={(checkedState) => fields.setAllowsDecimal(checkedState === true)}
          />
          {uiText.form.allowsDecimal}
        </Flex>
      </Text>
    </>
  );
}
