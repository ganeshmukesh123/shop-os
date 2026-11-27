import { THEME_PREFERENCES as CORE_THEME_PREFERENCES } from "@shopos/core";
import type { ThemePreference } from "./types";

/**
 * The first-paint cache in the page's local storage. The shop database holds the real choice
 * (spec 018 T035), so a change of page origin (PR C) costs at most one first paint.
 */
export const THEME_STORAGE_KEY = "shopos.themePreference";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export const THEME_PREFERENCES: readonly ThemePreference[] = CORE_THEME_PREFERENCES;

export const DARK_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** The app's Radix theme (design guidelines 2.1); only `appearance` changes at run time. */
export const RADIX_THEME_SETTINGS = {
  accentColor: "indigo",
  grayColor: "slate",
  radius: "medium",
  scaling: "110%",
} as const;
