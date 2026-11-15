import { useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import { Theme } from "@radix-ui/themes";
import { ThemeContext } from "./ThemeContext";
import { RADIX_THEME_SETTINGS } from "./theme.constants";
import type { ThemePreference } from "./theme.types";
import {
  getBrowserStorage,
  readStoredPreference,
  resolveAppearance,
  writeStoredPreference,
} from "./themePreference";
import { useSystemDarkMode } from "./useSystemDarkMode";

/**
 * Radix `Theme` has no "follow the system" option, so this resolves System to light or dark and
 * passes that on. The saved choice is read in the first render, so the first paint is already right.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
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

  return (
    <ThemeContext.Provider value={{ preference, appearance, setPreference }}>
      <Theme appearance={appearance} {...RADIX_THEME_SETTINGS}>
        {children}
      </Theme>
    </ThemeContext.Provider>
  );
}
