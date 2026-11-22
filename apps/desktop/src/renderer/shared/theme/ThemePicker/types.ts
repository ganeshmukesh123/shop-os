import type { ThemePreference } from "../types";

export interface IThemePickerProps {
  preference: ThemePreference;
  onChange: (nextPreference: ThemePreference) => void;
}
