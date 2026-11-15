import { SegmentedControl, Text } from "@radix-ui/themes";
import { uiText } from "../../strings";
import { THEME_PREFERENCES } from "./theme.constants";
import type { ThemePreference } from "./theme.types";

interface IThemePickerProps {
  preference: ThemePreference;
  onChange: (nextPreference: ThemePreference) => void;
}

/** System, Light or Dark. Every choice is a word, so nothing depends on how a colour looks. */
export function ThemePicker({ preference, onChange }: IThemePickerProps) {
  return (
    <div>
      <Text as="div" size="2" weight="bold" mb="1" id="theme-label">
        {uiText.theme.label}
      </Text>
      <SegmentedControl.Root
        size="2"
        value={preference}
        aria-labelledby="theme-label"
        onValueChange={(selectedValue) => onChange(selectedValue as ThemePreference)}
      >
        {THEME_PREFERENCES.map((themePreference) => (
          <SegmentedControl.Item key={themePreference} value={themePreference}>
            {uiText.theme[themePreference]}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
      <Text as="div" size="1" color="gray" mt="1">
        {uiText.theme.help}
      </Text>
    </div>
  );
}
