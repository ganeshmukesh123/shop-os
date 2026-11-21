import { useContext } from "react";
import { ThemeContext } from "../ThemeContext";
import type { IThemeContextValue } from "../types";

/** The saved choice, the light or dark it resolves to now, and a way to change the choice. */
export function useThemePreference(): IThemeContextValue {
  return useContext(ThemeContext);
}
