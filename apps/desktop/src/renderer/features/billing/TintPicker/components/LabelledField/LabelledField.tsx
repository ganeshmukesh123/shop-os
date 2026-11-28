import { Text, TextField } from "@radix-ui/themes";
import type { ILabelledFieldProps } from "./types";

/** A large text box with its label above it. */
export function LabelledField({ label, value, onChange }: ILabelledFieldProps) {
  return (
    <Text as="label" size="2" weight="medium">
      {label}
      <TextField.Root
        mt="1"
        size="3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Text>
  );
}
