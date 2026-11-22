import { TextField } from "@radix-ui/themes";
import { SettingsField } from "../SettingsField/SettingsField";
import type { IProfileTextFieldProps } from "./ProfileTextField.types";

/** One labelled text box in the shop profile. It reports the new text, not the browser event. */
export function ProfileTextField({
  label,
  help,
  value,
  maxLength,
  onTextChange,
}: IProfileTextFieldProps) {
  return (
    <SettingsField label={label} help={help}>
      <TextField.Root
        size="3"
        maxLength={maxLength}
        value={value}
        onChange={(changeEvent) => onTextChange(changeEvent.target.value)}
      />
    </SettingsField>
  );
}
