import type { ThemePreference } from "../types";

export interface IThemeSyncInput {
  /** From the database; null until a choice was first saved there. */
  savedTheme: ThemePreference | null;
  /** What the page showed on its first paint (localStorage, or System). */
  cachedPreference: ThemePreference;
}

export interface IThemeSyncPlan {
  preferenceToShow: ThemePreference;
  /** Set only when the database has no choice yet. */
  preferenceToCopy: ThemePreference | undefined;
}
