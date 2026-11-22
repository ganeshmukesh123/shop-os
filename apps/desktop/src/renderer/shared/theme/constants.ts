import type { ThemePreference } from "./types";

/** Kept per device in the browser's local storage (design guidelines D6, assumed). */
export const THEME_STORAGE_KEY = "shopos.themePreference";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

export const DARK_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** The app's Radix theme (design guidelines 2.1); only `appearance` changes at run time. */
export const RADIX_THEME_SETTINGS = {
  accentColor: "indigo",
  grayColor: "slate",
  radius: "medium",
  scaling: "110%",
} as const;
