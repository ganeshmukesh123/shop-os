import { DEFAULT_THEME_PREFERENCE, THEME_PREFERENCES, THEME_STORAGE_KEY } from "./theme.constants";
import type { IThemeStorage, ThemeAppearance, ThemePreference } from "./theme.types";

function isThemePreference(savedText: string | null): savedText is ThemePreference {
  return THEME_PREFERENCES.some((preference) => preference === savedText);
}

/** Radix `Theme` takes only light or dark, so System is turned into one of them here. */
export function resolveAppearance(
  preference: ThemePreference,
  isSystemDark: boolean,
): ThemeAppearance {
  if (preference !== "system") return preference;
  return isSystemDark ? "dark" : "light";
}

/** The saved choice, or System when nothing valid is saved or storage is blocked. */
export function readStoredPreference(storage: IThemeStorage | undefined): ThemePreference {
  try {
    const savedText = storage?.getItem(THEME_STORAGE_KEY) ?? null;
    return isThemePreference(savedText) ? savedText : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

/** Saves the choice for the next start. A blocked storage must not stop the choice applying now. */
export function writeStoredPreference(
  storage: IThemeStorage | undefined,
  preference: ThemePreference,
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The choice still applies for this session; it is only not remembered.
  }
}

/** Reading `window.localStorage` itself can throw when site data is blocked. */
export function getBrowserStorage(): IThemeStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
