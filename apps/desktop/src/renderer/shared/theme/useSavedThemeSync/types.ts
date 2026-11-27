import type { IThemeStore, ThemePreference } from "../types";

export interface ISavedThemeSyncOptions {
  themeStore: IThemeStore;
  /** The choice the first paint used. */
  cachedPreference: ThemePreference;
  /** Shows a choice and refreshes the cache, without saving it to the database again. */
  applyPreference: (preference: ThemePreference) => void;
  hasUserChosen: () => boolean;
}
