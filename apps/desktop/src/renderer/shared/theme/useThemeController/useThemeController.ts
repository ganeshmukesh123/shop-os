import { useCallback, useRef, useState } from "react";
import type { IThemeContextValue, IThemeStore, ThemePreference } from "../types";
import {
  getBrowserStorage,
  readStoredPreference,
  resolveAppearance,
  writeStoredPreference,
} from "../themePreference/themePreference";
import { DATABASE_THEME_STORE } from "../themeStore/themeStore";
import { useSavedThemeSync } from "../useSavedThemeSync/useSavedThemeSync";
import { useSystemDarkMode } from "../useSystemDarkMode/useSystemDarkMode";

/**
 * Owns the theme state. The first render reads the page's cached choice, so the first paint is
 * already right; then the shop database, which holds the real choice (spec 018 T035), takes over.
 */
export function useThemeController(
  themeStore: IThemeStore = DATABASE_THEME_STORE,
): IThemeContextValue {
  const [cachedPreference] = useState<ThemePreference>(() =>
    readStoredPreference(getBrowserStorage()),
  );
  const [preference, setPreferenceState] = useState<ThemePreference>(cachedPreference);
  const hasUserChosenRef = useRef(false);
  const isSystemDark = useSystemDarkMode();
  const appearance = resolveAppearance(preference, isSystemDark);

  const applyPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    writeStoredPreference(getBrowserStorage(), nextPreference);
  }, []);
  useSavedThemeSync({
    themeStore,
    cachedPreference,
    applyPreference,
    hasUserChosen: () => hasUserChosenRef.current,
  });

  const setPreference = useCallback(
    (nextPreference: ThemePreference) => {
      hasUserChosenRef.current = true;
      applyPreference(nextPreference);
      // A failed save keeps the choice for this session and in the cache.
      themeStore.save(nextPreference).catch(() => {});
    },
    [applyPreference, themeStore],
  );

  return { preference, appearance, setPreference };
}
