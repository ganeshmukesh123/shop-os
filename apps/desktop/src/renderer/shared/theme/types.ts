/** What the user chose in Settings. System follows the operating system. */
export type ThemePreference = "system" | "light" | "dark";

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
