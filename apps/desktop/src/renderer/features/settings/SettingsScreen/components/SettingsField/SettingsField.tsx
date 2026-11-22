import { Text } from "@radix-ui/themes";
import type { ISettingsFieldProps } from "./SettingsField.types";

/** A label above one input, with optional help text below it. */
export function SettingsField({ label, help, children }: ISettingsFieldProps) {
  return (
    <label>
      <Text as="div" size="2" weight="bold" mb="1">
        {label}
      </Text>
      {children}
      {help && (
        <Text as="div" size="1" color="gray" mt="1">
          {help}
        </Text>
      )}
    </label>
  );
}
