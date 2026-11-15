import fs from "node:fs";
import path from "node:path";
import type { App, BrowserWindow, Dialog, Session } from "electron";
import { CoreError } from "@shopos/core";
import { migrateConnection } from "../db/connection";
import { ensureSeed } from "../db/seed";
import {
  backupBeforeMigrating,
  needsPreMigrationBackup,
  openCheckedSqlite,
} from "../db/startupSafety";
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
import { offerRestoreForDamagedDatabase } from "./startupRecovery";

/** Copies taken just before a migration, kept beside the database (not in the owner's backup folder). */
export const PRE_MIGRATION_FOLDER_NAME = "pre-migration-backups";

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

/** Integrity check, then a backup if a migration is pending on real data, then migrate and seed (task T091). */
async function openShopDatabase(state: IAppState, config: IAppConfig, now: Date): Promise<void> {
  const dataFolder = path.dirname(config.databasePath);
  fs.mkdirSync(dataFolder, { recursive: true });
  const sqlite = openCheckedSqlite(config.databasePath);
  const needsBackup = needsPreMigrationBackup(sqlite, config.migrationsFolder);
  if (needsBackup) {
    await backupBeforeMigrating(sqlite, path.join(dataFolder, PRE_MIGRATION_FOLDER_NAME), now);
  }
  state.connection = migrateConnection(sqlite, config.migrationsFolder);
  state.context = ensureSeed(state.connection.db);
}

async function handleStartFailure(
  dependencies: IStartAppDependencies,
  config: IAppConfig,
  caughtError: unknown,
): Promise<void> {
  const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
  const isDamagedDatabase =
    caughtError instanceof CoreError && caughtError.code === "DATABASE_CORRUPT";
  if (isDamagedDatabase) {
    await offerRestoreForDamagedDatabase(dependencies, config.databasePath, message);
    return;
  }
  dependencies.dialog.showErrorBox("Shop OS could not start", message);
  dependencies.app.exit(1);
}

/** Opens the database, wires the commands, shows the window, and keeps backing up. Resolves once started. */
export function startApp(
  dependencies: IStartAppDependencies,
  config: IAppConfig,
  now: () => Date = () => new Date(),
): Promise<void> {
  const { app } = dependencies;
  const state = createAppState();
  registerQuitHooks(app, state);
  return app
    .whenReady()
    .then(async () => {
      await openShopDatabase(state, config, now());
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
    .catch((caughtError: unknown) => handleStartFailure(dependencies, config, caughtError));
}
