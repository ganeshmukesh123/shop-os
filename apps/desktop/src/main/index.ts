import { app, BrowserWindow, dialog, session } from "electron";
import { applyUserDataOverride, readAppConfig } from "./app/appConfig";
import { startApp } from "./app/startApp";

// Everything with logic lives in ./app and takes the Electron objects as arguments, so it can be tested
// with fakes. This entry file only hands the real ones over.
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
