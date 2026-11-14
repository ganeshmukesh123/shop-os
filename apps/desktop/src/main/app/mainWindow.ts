import type { BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import type { IAppConfig } from "./appConfig";

const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 800;
const WINDOW_MIN_WIDTH = 960;
const WINDOW_MIN_HEIGHT = 600;
const FILE_URL_PREFIX = "file://";

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

/** The page may stay on local files, or on the dev server while developing; any other address is blocked. */
export function isNavigationAllowed(
  url: string,
  config: Pick<IAppConfig, "isDev" | "rendererUrl">,
): boolean {
  const isDevServerUrl =
    config.isDev && config.rendererUrl !== undefined && url.startsWith(config.rendererUrl);
  return url.startsWith(FILE_URL_PREFIX) || isDevServerUrl;
}

export function createMainWindow(
  createBrowserWindow: CreateBrowserWindow,
  config: IAppConfig,
): void {
  const mainWindow = createBrowserWindow(buildMainWindowOptions(config.preloadPath));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (navigationEvent, url) => {
    if (!isNavigationAllowed(url, config)) navigationEvent.preventDefault();
  });
  void (config.isDev
    ? mainWindow.loadURL(config.rendererUrl!)
    : mainWindow.loadFile(config.rendererHtmlPath));
}
