import { createContext } from "react";
import { DEFAULT_THEME_PREFERENCE } from "./theme.constants";
import type { IThemeContextValue } from "./theme.types";

/** Without a provider (a test, a story) the app is light and a choice does nothing. */
export const ThemeContext = createContext<IThemeContextValue>({
  preference: DEFAULT_THEME_PREFERENCE,
  appearance: "light",
  setPreference: () => {},
});
