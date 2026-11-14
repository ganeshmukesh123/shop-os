import fs from "node:fs";
import path from "node:path";
import type { App, BrowserWindow, Dialog, Session } from "electron";
import { openDatabase } from "../db/connection";
import { ensureSeed } from "../db/seed";
import { registerIpc } from "../ipc";
import type { Services } from "../ipc/handlers";
import { BillRepository } from "../repositories/BillRepository";
import { SettingsRepository } from "../repositories/SettingsRepository";
import { BackupService } from "../services/BackupService";
import { BillingService } from "../services/BillingService";
import { electronRenderer } from "../services/electronRenderer";
import { InventoryService } from "../services/InventoryService";
import { PrintService } from "../services/PrintService";
import { SettingsService } from "../services/SettingsService";
import { BACKUP_EVERY_MILLISECONDS, type IAppConfig } from "./appConfig";
import { createAppState, type IAppState } from "./appState";
import { registerQuitHooks, startBackupTimer } from "./backupLifecycle";
import { createMainWindow, type CreateBrowserWindow } from "./mainWindow";
import { installSecurityHeaders } from "./securityHeaders";
import { createShell } from "./shell";

export interface IStartAppDependencies {
  app: Pick<App, "whenReady" | "on" | "quit" | "relaunch" | "exit">;
  dialog: Pick<Dialog, "showOpenDialog" | "showSaveDialog" | "showErrorBox">;
  /** Read only after the app is ready: Electron has no default session before that. */
  getDefaultSession: () => Pick<Session, "webRequest">;
  createBrowserWindow: CreateBrowserWindow;
  getAllWindows: () => readonly unknown[];
  getFocusedWindow: () => BrowserWindow | undefined;
}

function buildServices(state: IAppState): Services {
  const { db, sqlite } = state.connection!;
  const context = state.context!;
  state.backup = new BackupService(sqlite, db, context);
  return {
    inventory: new InventoryService(db, context),
    billing: new BillingService(db, context),
    settings: new SettingsService(db, context),
    print: new PrintService(
      new BillRepository(db, context),
      new SettingsRepository(db, context),
      electronRenderer,
    ),
    backup: state.backup,
  };
}

function openShopDatabase(state: IAppState, config: IAppConfig): void {
  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  state.connection = openDatabase(config.databasePath, {
    migrationsFolder: config.migrationsFolder,
  });
  state.context = ensureSeed(state.connection.db);
}

function showStartFailure(dependencies: IStartAppDependencies, caughtError: unknown): void {
  const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
  dependencies.dialog.showErrorBox("Shop OS could not start", message);
  dependencies.app.exit(1);
}

/** Opens the database, wires the commands, shows the window, and keeps backing up. Resolves once started. */
export function startApp(dependencies: IStartAppDependencies, config: IAppConfig): Promise<void> {
  const { app } = dependencies;
  const state = createAppState();
  registerQuitHooks(app, state);
  return app
    .whenReady()
    .then(() => {
      openShopDatabase(state, config);
      const services = buildServices(state);
      installSecurityHeaders(dependencies.getDefaultSession(), config.isDev);
      registerIpc(
        services,
        createShell({ ...dependencies, state, databasePath: config.databasePath }),
      );
      createMainWindow(dependencies.createBrowserWindow, config);
      startBackupTimer(state, BACKUP_EVERY_MILLISECONDS);
      app.on("activate", () => {
        if (dependencies.getAllWindows().length === 0) {
          createMainWindow(dependencies.createBrowserWindow, config);
        }
      });
    })
    .catch((caughtError: unknown) => showStartFailure(dependencies, caughtError));
}
