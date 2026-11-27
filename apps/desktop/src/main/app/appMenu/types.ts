import type { Menu, MenuItemConstructorOptions } from "electron";
import type { KEEP_DEFAULT_MENU } from "./constants";

export interface IMenuContext {
  platform: NodeJS.Platform;
  isPackaged: boolean;
}

/** A template to build, null for no menu at all, or keep Electron's default. */
export type AppMenuChoice = readonly MenuItemConstructorOptions[] | null | typeof KEEP_DEFAULT_MENU;

export type IMenuApi = Pick<typeof Menu, "buildFromTemplate" | "setApplicationMenu">;
