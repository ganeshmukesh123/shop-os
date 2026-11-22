import { createContext } from "react";
import { DEFAULT_THEME_PREFERENCE } from "./constants";
import type { IThemeContextValue } from "./types";

/** Without a provider (a test, a story) the app is light and a choice does nothing. */
export const ThemeContext = createContext<IThemeContextValue>({
  preference: DEFAULT_THEME_PREFERENCE,
  appearance: "light",
  setPreference: () => {},
});
