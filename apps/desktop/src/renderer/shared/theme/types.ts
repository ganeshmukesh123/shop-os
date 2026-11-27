import type { ThemePreference } from "@shopos/core";

/** What the user chose in Settings. System follows the operating system. Defined in core, which the database checks. */
export type { ThemePreference };

/** What Radix `Theme` can show: it has no "system" of its own. */
export type ThemeAppearance = "light" | "dark";

export interface IThemeContextValue {
  preference: ThemePreference;
  appearance: ThemeAppearance;
  setPreference: (nextPreference: ThemePreference) => void;
}

/** The part of the browser's storage the theme needs; lets tests pass a fake. */
export interface IThemeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/** Where the choice is kept for good: the shop database (spec 018 T035); tests pass a fake. */
export interface IThemeStore {
  /** null when no choice was saved yet. Rejects when the database cannot be reached. */
  load: () => Promise<ThemePreference | null>;
  save: (preference: ThemePreference) => Promise<void>;
}
