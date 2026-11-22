import type { ReactNode } from "react";
import { Theme } from "@radix-ui/themes";
import { ThemeContext } from "../ThemeContext";
import { RADIX_THEME_SETTINGS } from "../constants";
import { useThemeController } from "../useThemeController";

/**
 * Radix `Theme` has no "follow the system" option, so the controller resolves System to light or
 * dark and this passes that on.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeController = useThemeController();

  return (
    <ThemeContext.Provider value={themeController}>
      <Theme appearance={themeController.appearance} {...RADIX_THEME_SETTINGS}>
        {children}
      </Theme>
    </ThemeContext.Provider>
  );
}
