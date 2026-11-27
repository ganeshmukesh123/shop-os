import type { MenuItemConstructorOptions } from "electron";
import { KEEP_DEFAULT_MENU, MAC_MENU_TEMPLATE } from "./constants";
import type { AppMenuChoice, IMenuApi, IMenuContext } from "./types";

const MAC_PLATFORM = "darwin";

/**
 * Spec 018 FR-009 and decision D2. Mac keeps a minimal menu so copy, paste and quit shortcuts
 * work; Windows and Linux need no menu for them. A packaged build never offers Reload or DevTools.
 */
export function buildAppMenuTemplate(context: IMenuContext): AppMenuChoice {
  const isMac = context.platform === MAC_PLATFORM;
  const packagedChoice = isMac ? MAC_MENU_TEMPLATE : null;
  return context.isPackaged ? packagedChoice : KEEP_DEFAULT_MENU;
}

export function installAppMenu(menuApi: IMenuApi, context: IMenuContext): void {
  const menuChoice = buildAppMenuTemplate(context);
  const isDefaultKept = menuChoice === KEEP_DEFAULT_MENU;
  if (isDefaultKept) {
    return;
  }
  const builtMenu =
    menuChoice === null
      ? null
      : menuApi.buildFromTemplate(menuChoice as MenuItemConstructorOptions[]);
  menuApi.setApplicationMenu(builtMenu);
}
