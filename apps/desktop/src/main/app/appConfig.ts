import path from "node:path";
import { pathToFileURL } from "node:url";
import type { App } from "electron";

export const BACKUP_EVERY_MILLISECONDS = 15 * 60 * 1000;
const DATABASE_FILE_NAME = "shopos.sqlite";
const DEV_DATABASE_FILE_NAME = "shopos-dev.sqlite";

export type IEnvironment = Record<string, string | undefined>;

export interface IAppConfig {
  /** True only when running from the dev server, never in a packaged app. */
  isDev: boolean;
  rendererUrl: string | undefined;
  databasePath: string;
  migrationsFolder: string;
  preloadPath: string;
  rendererHtmlPath: string;
}

export interface IAppLocations {
  /** Where Electron unpacks resources in a packaged app. */
  resourcesPath: string;
  /** The folder the main bundle runs from. */
  baseDirectory: string;
}

/** Tests point the app at a throwaway data folder. Must run before the database path is read. */
export function applyUserDataOverride(app: Pick<App, "setPath">, environment: IEnvironment): void {
  const userDataOverride = environment["SHOPOS_USER_DATA"];
  if (userDataOverride) app.setPath("userData", userDataOverride);
}

export function readAppConfig(
  app: Pick<App, "isPackaged" | "getPath">,
  environment: IEnvironment,
  locations: IAppLocations,
): IAppConfig {
  const rendererUrl = environment["ELECTRON_RENDERER_URL"];
  const isDev = !app.isPackaged && !!rendererUrl;
  // A throwaway database in dev, so development never touches real shop data.
  const databaseFileName = isDev ? DEV_DATABASE_FILE_NAME : DATABASE_FILE_NAME;
  return {
    isDev,
    rendererUrl,
    databasePath: path.join(app.getPath("userData"), databaseFileName),
    migrationsFolder: app.isPackaged
      ? path.join(locations.resourcesPath, "drizzle")
      : path.resolve(locations.baseDirectory, "../../drizzle"),
    preloadPath: path.join(locations.baseDirectory, "../preload/index.js"),
    rendererHtmlPath: path.join(locations.baseDirectory, "../renderer/index.html"),
  };
}

/** The only pages allowed to send commands: the app's own page, or the dev server while developing. */
export function listTrustedPageUrls(
  config: Pick<IAppConfig, "isDev" | "rendererUrl" | "rendererHtmlPath">,
): string[] {
  const isDevServerTrusted = config.isDev && config.rendererUrl !== undefined;
  return isDevServerTrusted
    ? [config.rendererUrl as string]
    : [pathToFileURL(config.rendererHtmlPath).href];
}
