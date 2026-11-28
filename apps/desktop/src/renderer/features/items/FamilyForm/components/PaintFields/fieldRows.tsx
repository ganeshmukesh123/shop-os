import { Box, Checkbox, Flex, Select, Text, TextField } from "@radix-ui/themes";
import type { ICheckboxRowProps, ISelectRowProps, ITextFieldRowProps } from "./types";

/** A labelled text field (the label names the field for screen readers too). */
export function TextFieldRow({
  label,
  value,
  inputMode,
  maxLength,
  required,
  onChange,
}: ITextFieldRowProps) {
  return (
    <Box flexGrow="1" asChild>
      <label>
        <Text as="div" size="2" weight="bold" mb="1">
          {label}
        </Text>
        <TextField.Root
          size="3"
          aria-label={label}
          inputMode={inputMode}
          maxLength={maxLength}
          required={required}
          value={value}
          onChange={(changeEvent) => onChange(changeEvent.target.value)}
        />
      </label>
    </Box>
  );
}

/** A labelled Radix Select; an empty value shows the placeholder until one is chosen. */
export function SelectRow({ label, value, options, required, onChange }: ISelectRowProps) {
  return (
    <Box flexGrow="1" asChild>
      <label>
        <Text as="div" size="2" weight="bold" mb="1">
          {label}
        </Text>
        <Select.Root value={value || undefined} required={required} onValueChange={onChange}>
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

export function CheckboxRow({ label, isChecked, onChange }: ICheckboxRowProps) {
  return (
    <Text as="label" size="2">
      <Flex gap="2" align="center">
        <Checkbox checked={isChecked} onCheckedChange={(state) => onChange(state === true)} />
        {label}
      </Flex>
    </Text>
  );
}
