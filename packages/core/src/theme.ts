import { z } from "zod";

/** The screen's light or dark choice; System follows the operating system (design guidelines 3). */
export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const settingsSetThemeInput = z.object({ theme: z.enum(THEME_PREFERENCES) });
export type SettingsSetThemeInput = z.infer<typeof settingsSetThemeInput>;

/** null until the screen first saves a choice (it then copies its old localStorage one, spec 018 T035). */
export type SavedTheme = { theme: ThemePreference | null };
