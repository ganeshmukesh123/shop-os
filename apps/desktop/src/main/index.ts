import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow, dialog, session } from "electron";
import { openDatabase, type Connection } from "./db/connection";
import { ensureSeed } from "./db/seed";
import { registerIpc } from "./ipc";
import type { Services, Shell } from "./ipc/handlers";
import { BackupService, restoreBackup } from "./services/BackupService";
import { BillingService } from "./services/BillingService";
import { electronRenderer } from "./services/electronRenderer";
import { InventoryService } from "./services/InventoryService";
import { PrintService } from "./services/PrintService";
import { SettingsService } from "./services/SettingsService";
import { BillRepository } from "./repositories/BillRepository";
import { SettingsRepository } from "./repositories/SettingsRepository";

// Tests point the app at a throwaway data folder.
if (process.env["SHOPOS_USER_DATA"]) app.setPath("userData", process.env["SHOPOS_USER_DATA"]);

const isDev = !app.isPackaged && !!process.env["ELECTRON_RENDERER_URL"];
// A throwaway database in dev, so development never touches real shop data.
const dbPath = path.join(app.getPath("userData"), isDev ? "shopos-dev.sqlite" : "shopos.sqlite");
const migrationsFolder = app.isPackaged
  ? path.join(process.resourcesPath, "drizzle")
  : path.resolve(__dirname, "../../drizzle");
const BACKUP_EVERY_MS = 15 * 60 * 1000;

let conn: Connection | null = null;
let backup: BackupService | null = null;
let backupTimer: NodeJS.Timeout | null = null;
let quitting = false;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "Shop OS",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (navigationEvent, url) => {
    if (
      !url.startsWith("file://") &&
      !(isDev && url.startsWith(process.env["ELECTRON_RENDERER_URL"]!))
    )
      navigationEvent.preventDefault();
  });
  if (isDev) void win.loadURL(process.env["ELECTRON_RENDERER_URL"]!);
  else void win.loadFile(path.join(__dirname, "../renderer/index.html"));
}

function pickShell(): Shell {
  const focused = () => BrowserWindow.getFocusedWindow() ?? undefined;
  return {
    async pickFolder() {
      const openDialogResult = await dialog.showOpenDialog(focused()!, {
        properties: ["openDirectory", "createDirectory"],
      });
      return openDialogResult.canceled ? null : (openDialogResult.filePaths[0] ?? null);
    },
    async pickBackupFile() {
      const openDialogResult = await dialog.showOpenDialog(focused()!, {
        properties: ["openFile"],
        filters: [{ name: "Shop OS backup", extensions: ["sqlite"] }],
      });
      return openDialogResult.canceled ? null : (openDialogResult.filePaths[0] ?? null);
    },
    async pickPdfPath(defaultName) {
      const saveDialogResult = await dialog.showSaveDialog(focused()!, {
        defaultPath: defaultName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      return saveDialogResult.canceled ? null : (saveDialogResult.filePath ?? null);
    },
    scheduleRestore(filePath) {
      // Reply to the renderer first, then swap the file while nothing has the database open.
      setTimeout(() => {
        try {
          quitting = true;
          if (backupTimer) clearInterval(backupTimer);
          conn?.sqlite.close();
          restoreBackup(filePath, dbPath);
          app.relaunch();
        } catch (caughtError) {
          dialog.showErrorBox(
            "Restore failed",
            caughtError instanceof Error ? caughtError.message : String(caughtError),
          );
        }
        app.exit(0);
      }, 200);
    },
  };
}

function setSecurityHeaders(): void {
  const policy = isDev
    ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: ws://localhost:* http://localhost:*"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [policy] } });
  });
}

async function runBackupQuietly(): Promise<void> {
  try {
    if (backup && new SettingsRepository(conn!.db, ctx!).get().backupFolder) await backup.run();
  } catch (caughtError) {
    console.error(
      "Backup failed (shown in Settings):",
      caughtError instanceof Error ? caughtError.message : caughtError,
    );
  }
}

let ctx: ReturnType<typeof ensureSeed> | null = null;

void app
  .whenReady()
  .then(() => {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    conn = openDatabase(dbPath, { migrationsFolder });
    ctx = ensureSeed(conn.db);
    const { db, sqlite } = conn;
    backup = new BackupService(sqlite, db, ctx);
    const services: Services = {
      inventory: new InventoryService(db, ctx),
      billing: new BillingService(db, ctx),
      settings: new SettingsService(db, ctx),
      print: new PrintService(
        new BillRepository(db, ctx),
        new SettingsRepository(db, ctx),
        electronRenderer,
      ),
      backup,
    };
    setSecurityHeaders();
    registerIpc(services, pickShell());
    createWindow();
    backupTimer = setInterval(() => void runBackupQuietly(), BACKUP_EVERY_MS);
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((caughtError: unknown) => {
    dialog.showErrorBox(
      "Shop OS could not start",
      caughtError instanceof Error ? caughtError.message : String(caughtError),
    );
    app.exit(1);
  });

// Back up once more on close, then quit.
app.on("before-quit", (quitEvent) => {
  if (quitting || !backup) return;
  quitting = true;
  quitEvent.preventDefault();
  if (backupTimer) clearInterval(backupTimer);
  void runBackupQuietly().finally(() => {
    conn?.sqlite.close();
    app.quit();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
