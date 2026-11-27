import type { MenuItemConstructorOptions } from "electron";

/** Returned when the app should keep Electron's own menu (unpackaged: developers need DevTools). */
export const KEEP_DEFAULT_MENU = "keep-default-menu";

/**
 * Mac: the app menu keeps About, Hide and Quit (Cmd+Q); the Edit menu keeps Cmd+C, Cmd+V, Cmd+X,
 * Cmd+A and undo, which a Mac app loses without a menu. No View menu: no Reload, no DevTools.
 */
export const MAC_MENU_TEMPLATE: readonly MenuItemConstructorOptions[] = [
  { role: "appMenu" },
  { role: "editMenu" },
];
