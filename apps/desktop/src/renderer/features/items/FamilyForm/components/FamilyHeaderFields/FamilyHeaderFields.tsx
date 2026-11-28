import { Box, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { FAMILY_KINDS, type FamilyKind } from "@shopos/core";
import { uiText } from "../../../../../shared/text/strings";
import type { IFamilyHeaderFieldsProps, ILabelledSelectProps } from "./types";

/** Radix Select needs a non-empty value, so "no category" and "no brand" use this one. */
const NONE = "none";

function LabelledSelect({ label, value, options, onChange }: ILabelledSelectProps) {
  return (
    <Box flexGrow="1" asChild>
      <label>
        <Text as="div" size="2" weight="bold" mb="1">
          {label}
        </Text>
        <Select.Root
          value={value || NONE}
          onValueChange={(chosen) => onChange(chosen === NONE ? "" : chosen)}
        >
          <Select.Trigger className="shopos-full-width" aria-label={label} />
          <Select.Content>
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </label>
    </Box>
  );
}

/** The family's name, kind, category, brand and unit (spec 002 T036). */
export function FamilyHeaderFields(props: IFamilyHeaderFieldsProps) {
  const text = uiText.family;
  const none = { value: NONE, label: text.none };
  return (
    <Flex direction="column" gap="3">
      <label>
        <Text as="div" size="2" weight="bold" mb="1">
          {text.name} *
        </Text>
        <TextField.Root
          size="3"
          autoFocus
          maxLength={120}
          aria-label={text.name}
          value={props.name}
          onChange={(changeEvent) => props.setName(changeEvent.target.value)}
        />
      </label>
      <Flex gap="3">
        <LabelledSelect
          label={text.kind}
          value={props.kind}
          options={FAMILY_KINDS.map((kind) => ({ value: kind, label: text.kinds[kind] }))}
          onChange={(kind) => props.setKind(kind as FamilyKind)}
        />
        <LabelledSelect
          label={text.unit}
          value={props.unit}
          options={[none, ...props.units.map((unit) => ({ value: unit.code, label: unit.label }))]}
          onChange={props.setUnit}
        />
      </Flex>
      <Flex gap="3">
        <LabelledSelect
          label={text.category}
          value={props.categoryId}
          options={[
            none,
            ...props.categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
          onChange={props.setCategoryId}
        />
        <LabelledSelect
          label={text.brand}
          value={props.brandId}
          options={[none, ...props.brands.map((brand) => ({ value: brand.id, label: brand.name }))]}
          onChange={props.setBrandId}
        />
      </Flex>
    </Flex>
  );
}
