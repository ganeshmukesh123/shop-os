import type { BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import type { IAppConfig } from "./appConfig";
import { isNavigationAllowed } from "./navigationPolicy/navigationPolicy";

const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 800;
const WINDOW_MIN_WIDTH = 960;
const WINDOW_MIN_HEIGHT = 600;

export type IMainWindow = Pick<BrowserWindow, "loadURL" | "loadFile"> & {
  webContents: Pick<BrowserWindow["webContents"], "setWindowOpenHandler" | "on">;
};
export type CreateBrowserWindow = (options: BrowserWindowConstructorOptions) => IMainWindow;

/** Security defaults (constitution): isolated, sandboxed, no Node in the page. */
export function buildMainWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    title: "Shop OS",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  };
}

export function createMainWindow(
  createBrowserWindow: CreateBrowserWindow,
  config: IAppConfig,
): void {
  const mainWindow = createBrowserWindow(buildMainWindowOptions(config.preloadPath));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const blockForeignAddress = (navigationEvent: { preventDefault(): void }, url: string): void => {
    const isAllowed = isNavigationAllowed(url, config);
    if (isAllowed) {
      return;
    }
    navigationEvent.preventDefault();
  };
  mainWindow.webContents.on("will-navigate", blockForeignAddress);
  // A page that is allowed may still redirect somewhere else; that target gets the same check.
  mainWindow.webContents.on("will-redirect", blockForeignAddress);
  void (config.isDev
    ? mainWindow.loadURL(config.rendererUrl!)
    : mainWindow.loadFile(config.rendererHtmlPath));
}
