import { pathToFileURL } from "node:url";
import type { INavigationConfig } from "./types";

function parseAddress(address: string): URL | null {
  try {
    return new URL(address);
  } catch {
    return null;
  }
}

/** The app's own page: same scheme and exact path. A query or hash does not change the page. */
function isAppPage(target: URL, appPage: URL): boolean {
  return target.protocol === appPage.protocol && target.pathname === appPage.pathname;
}

/** The dev server: same scheme, host and port (host includes the port), any path. */
function isDevServer(target: URL, devServer: URL): boolean {
  return target.protocol === devServer.protocol && target.host === devServer.host;
}

/**
 * The window may show only the app's own page, or the dev server while developing. Addresses are
 * parsed and compared part by part, never matched by text prefix (security checklist item 13).
 */
export function isNavigationAllowed(address: string, config: INavigationConfig): boolean {
  const target = parseAddress(address);
  const devServerAddress = config.isDev ? config.rendererUrl : undefined;
  const devServer = devServerAddress === undefined ? null : parseAddress(devServerAddress);
  const isOwnPage = target !== null && isAppPage(target, pathToFileURL(config.rendererHtmlPath));
  const isDevServerPage = target !== null && devServer !== null && isDevServer(target, devServer);
  return isOwnPage || isDevServerPage;
}
