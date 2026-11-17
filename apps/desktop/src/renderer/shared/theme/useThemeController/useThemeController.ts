import { useCallback, useState } from "react";
import type { IThemeContextValue, ThemePreference } from "../types";
import {
  getBrowserStorage,
  readStoredPreference,
  resolveAppearance,
  writeStoredPreference,
} from "../themePreference/themePreference";
import { useSystemDarkMode } from "../useSystemDarkMode/useSystemDarkMode";

/**
 * Owns the theme state: the saved choice (read in the first render, so the first paint is already
 * right) and the light or dark it resolves to.
 */
export function useThemeController(): IThemeContextValue {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readStoredPreference(getBrowserStorage()),
  );
  const isSystemDark = useSystemDarkMode();
  const appearance = resolveAppearance(preference, isSystemDark);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    writeStoredPreference(getBrowserStorage(), nextPreference);
  }, []);

  return { preference, appearance, setPreference };
}
