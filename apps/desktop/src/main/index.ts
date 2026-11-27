import { app, BrowserWindow, dialog, Menu, session } from "electron";
import { installAppMenu } from "./app/appMenu/appMenu";
import { applyUserDataOverride, readAppConfig } from "./app/appConfig";
import { isStartAllowedBySwitches } from "./app/debugSwitchPolicy/debugSwitchPolicy";
import { startApp } from "./app/startApp";

// Everything with logic lives in ./app and takes the Electron objects as arguments, so it can be tested
// with fakes. This entry file only hands the real ones over.
function startShopOs(): void {
  // Before ready, so Electron never builds its default menu (spec 018 FR-009).
  installAppMenu(Menu, { platform: process.platform, isPackaged: app.isPackaged });
  applyUserDataOverride(app, process.env);
  void startApp(
    {
      app,
      dialog,
      getDefaultSession: () => session.defaultSession,
      createBrowserWindow: (windowOptions) => new BrowserWindow(windowOptions),
      getAllWindows: () => BrowserWindow.getAllWindows(),
      getFocusedWindow: () => BrowserWindow.getFocusedWindow() ?? undefined,
    },
    readAppConfig(app, process.env, {
      resourcesPath: process.resourcesPath,
      baseDirectory: __dirname,
    }),
  );
}

// A packaged release started with a DevTools switch exits here (spec 018 O15).
const isStartAllowed = isStartAllowedBySwitches(app, __SHOPOS_ALLOWS_DEBUG_SWITCHES__);
if (isStartAllowed) {
  startShopOs();
}
