import { call } from "../../api/api";
import type { IThemeStore } from "../types";

/** The theme choice kept in the shop database through the typed commands (spec 018 T035). */
export const DATABASE_THEME_STORE: IThemeStore = {
  load: async () => (await call("settings.getTheme", {})).theme,
  save: async (preference) => {
    await call("settings.setTheme", { theme: preference });
  },
};
