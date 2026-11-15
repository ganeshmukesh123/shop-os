import { useCallback, useLayoutEffect, useState } from "react";
import type { IThemeContextValue, ThemePreference } from "./theme.types";
import {
  getBrowserStorage,
  readStoredPreference,
  resolveAppearance,
  writeStoredPreference,
} from "./themePreference";
import { useSystemDarkMode } from "./useSystemDarkMode";

/**
 * Owns the theme state: the saved choice (read in the first render, so the first paint is already
 * right), the light or dark it resolves to, and the page's colour scheme.
 */
export function useThemeController(): IThemeContextValue {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readStoredPreference(getBrowserStorage()),
  );
  const isSystemDark = useSystemDarkMode();
  const appearance = resolveAppearance(preference, isSystemDark);

  // Lets the browser colour the page edge and scrollbars to match. A layout effect runs before the paint.
  useLayoutEffect(() => {
    document.documentElement.style.colorScheme = appearance;
  }, [appearance]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    writeStoredPreference(getBrowserStorage(), nextPreference);
  }, []);

  return { preference, appearance, setPreference };
}
