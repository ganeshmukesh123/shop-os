import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { createShell } from "../../src/main/app/shell";
import { BillingService } from "../../src/main/services/BillingService";
import { InventoryService } from "../../src/main/services/InventoryService";
import { planRestoreNumbering } from "../../src/main/services/RestoreNumbering";
import { buildAppStateFixture, makeTempFolder } from "../helpers/appStateFixture";
import { MIGRATIONS } from "../helpers/testDb";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function buildDialog() {
  return {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showErrorBox: vi.fn(),
  };
}

function buildShell(
  options: {
    scheduleLater?: (task: () => void, delay: number) => unknown;
    migrationsFolder?: string;
  } = {},
) {
  const fixture = buildAppStateFixture();
  const dialog = buildDialog();
  const app = { relaunch: vi.fn(), exit: vi.fn() };
  const databasePath = path.join(makeTempFolder(), "shopos.sqlite");
  const shell = createShell({
    dialog: dialog as never,
    getFocusedWindow: () => undefined,
    app,
    state: fixture.state,
    databasePath,
    migrationsFolder: MIGRATIONS,
    ...options,
  });
  return { shell, dialog, app, databasePath, ...fixture };
}

describe("native dialogs", () => {
  it("returns the folder the owner chose and asks for a folder dialog", async () => {
    const { shell, dialog } = buildShell();
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/Volumes/Backup"] });
    expect(await shell.pickFolder()).toBe("/Volumes/Backup");
    expect(dialog.showOpenDialog.mock.calls[0]?.[1]).toEqual({
      properties: ["openDirectory", "createDirectory"],
    });
  });

  it("returns null when the folder dialog is cancelled or returns nothing", async () => {
    const { shell, dialog } = buildShell();
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: ["/ignored"] });
    expect(await shell.pickFolder()).toBeNull();
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [] });
    expect(await shell.pickFolder()).toBeNull();
  });

  it("offers only .sqlite files when picking a backup", async () => {
    const { shell, dialog } = buildShell();
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/b/20261207.sqlite"] });
    expect(await shell.pickBackupFile()).toBe("/b/20261207.sqlite");
    expect(dialog.showOpenDialog.mock.calls[0]?.[1]).toEqual({
      properties: ["openFile"],
      filters: [{ name: "Shop OS backup", extensions: ["sqlite"] }],
    });
  });

  it("returns null when the backup dialog is cancelled or returns nothing", async () => {
    const { shell, dialog } = buildShell();
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await shell.pickBackupFile()).toBeNull();
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [] });
    expect(await shell.pickBackupFile()).toBeNull();
  });

  it("suggests the bill's file name in the save dialog and offers PDF only", async () => {
    const { shell, dialog } = buildShell();
    dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/C1-000123.pdf" });
    expect(await shell.pickPdfPath("C1-000123.pdf")).toBe("/tmp/C1-000123.pdf");
    expect(dialog.showSaveDialog.mock.calls[0]?.[1]).toEqual({
      defaultPath: "C1-000123.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
  });

  it("returns null when the save dialog is cancelled or returns no path", async () => {
    const { shell, dialog } = buildShell();
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: true });
    expect(await shell.pickPdfPath("a.pdf")).toBeNull();
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false });
    expect(await shell.pickPdfPath("a.pdf")).toBeNull();
  });
});

describe("scheduleRestore", () => {
  /** A real backup file of the test shop, made by the backup service. */
  async function makeBackupFile(fixture: ReturnType<typeof buildAppStateFixture>): Promise<string> {
    const result = await fixture.state.backup!.run();
    return result.path;
  }

  it("waits 200 ms so the reply reaches the renderer first, then restores", () => {
    vi.useFakeTimers();
    const { shell, app } = buildShell();
    shell.scheduleRestore(path.join(makeTempFolder(), "missing.sqlite"));
    vi.advanceTimersByTime(199);
    expect(app.exit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(app.exit).toHaveBeenCalledWith(0);
  });

  it("closes the database, replaces the live file with the backup, relaunches and exits", async () => {
    let task: (() => void) | undefined;
    const fixture = buildAppStateFixture();
    const backupFile = await makeBackupFile(fixture);
    const { shell, app, databasePath, state } = buildShell({
      scheduleLater: (scheduledTask) => void (task = scheduledTask),
    });
    state.connection = fixture.state.connection;
    fs.writeFileSync(databasePath, "old contents");
    shell.scheduleRestore(backupFile);
    task?.();
    const restored = new Database(databasePath, { readonly: true });
    expect(restored.prepare("select count(*) as tableCount from sqlite_master").get()).not.toEqual({
      tableCount: 0,
    });
    restored.close();
    expect(app.relaunch).toHaveBeenCalledOnce();
    expect(app.exit).toHaveBeenCalledWith(0);
    expect(state.isQuitting).toBe(true);
    expect(fixture.testDb.sqlite.open).toBe(false);
  });

  it("stops the periodic backup timer before restoring", () => {
    let task: (() => void) | undefined;
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const { shell, state } = buildShell({
      scheduleLater: (scheduledTask) => void (task = scheduledTask),
    });
    state.backupTimer = setInterval(() => {}, 100_000);
    shell.scheduleRestore(path.join(makeTempFolder(), "missing.sqlite"));
    task?.();
    expect(clearIntervalSpy).toHaveBeenCalledWith(state.backupTimer);
  });

  it("shows the reason and still exits when the backup cannot be restored", () => {
    let task: (() => void) | undefined;
    const { shell, dialog, app } = buildShell({
      scheduleLater: (scheduledTask) => void (task = scheduledTask),
    });
    shell.scheduleRestore(path.join(makeTempFolder(), "missing.sqlite"));
    task?.();
    expect(dialog.showErrorBox).toHaveBeenCalledWith(
      "Restore failed",
      expect.stringContaining("not a valid Shop OS backup"),
    );
    expect(app.relaunch).not.toHaveBeenCalled();
    expect(app.exit).toHaveBeenCalledWith(0);
  });

  it("shows a plain text failure as it is, and still exits", async () => {
    let task: (() => void) | undefined;
    const fixture = buildAppStateFixture();
    const backupFile = await makeBackupFile(fixture);
    const { shell, dialog, app } = buildShell({
      scheduleLater: (scheduledTask) => void (task = scheduledTask),
    });
    app.relaunch.mockImplementation(() => {
      throw "relaunch refused";
    });
    shell.scheduleRestore(backupFile);
    task?.();
    expect(dialog.showErrorBox).toHaveBeenCalledWith("Restore failed", "relaunch refused");
    expect(app.exit).toHaveBeenCalledWith(0);
  });
});

describe("scheduleRestore with a bill-number plan (task T083, FR-013b, EC-19)", () => {
  /** A shop with one saved bill and a real backup of it; returns the backup file and the bill's financial year. */
  async function shopWithBackup() {
    const fixture = buildAppStateFixture();
    const { db, ctx } = fixture.testDb;
    const itemId = new InventoryService(db, ctx).createItem({
      name: "Pipe",
      unit: "pcs",
      pricePaise: 10000,
      openingQtyMilli: 10000,
    }).item.id;
    const billNumber = new BillingService(db, ctx).saveBill({
      clientBillId: crypto.randomUUID(),
      paymentMode: "cash",
      billDiscountPaise: 0,
      lines: [{ itemId, quantityMilli: 1000, ratePaise: 10000, lineDiscountPaise: 0 }],
    }).bill.number;
    const backup = await fixture.state.backup!.run();
    return { fixture, backupFile: backup.path, financialYear: billNumber.split("/")[1]! };
  }

  it("records the lost numbers in the restored database, then relaunches", async () => {
    let task: (() => void) | undefined;
    const { fixture, backupFile, financialYear } = await shopWithBackup();
    const plan = planRestoreNumbering(backupFile, `C1/${financialYear}/000005`, new Date());
    const { shell, app, databasePath, state } = buildShell({
      scheduleLater: (scheduledTask) => void (task = scheduledTask),
    });
    state.connection = fixture.state.connection;

    shell.scheduleRestore(backupFile, plan);
    task?.();

    const restored = new Database(databasePath, { readonly: true });
    expect(restored.prepare("select seq_from, seq_to, reason from bill_number_gap").all()).toEqual([
      { seq_from: 2, seq_to: 5, reason: "lost_in_restore" },
    ]);
    expect(restored.prepare("select last_seq from number_series").get()).toEqual({ last_seq: 5 });
    restored.close();
    expect(app.relaunch).toHaveBeenCalledOnce();
    expect(app.exit).toHaveBeenCalledWith(0);
  });

  it("leaves the live database as it was, says why, and does not relaunch when the numbering cannot be applied", async () => {
    let task: (() => void) | undefined;
    const { fixture, backupFile, financialYear } = await shopWithBackup();
    const plan = planRestoreNumbering(backupFile, `C1/${financialYear}/000005`, new Date());
    const { shell, app, dialog, databasePath, state } = buildShell({
      scheduleLater: (scheduledTask) => void (task = scheduledTask),
      migrationsFolder: "/no/such/migrations",
    });
    state.connection = fixture.state.connection;
    fs.writeFileSync(databasePath, "old contents");

    shell.scheduleRestore(backupFile, plan);
    task?.();

    expect(fs.readFileSync(databasePath, "utf8")).toBe("old contents");
    expect(dialog.showErrorBox).toHaveBeenCalledWith("Restore failed", expect.any(String));
    expect(app.relaunch).not.toHaveBeenCalled();
    expect(app.exit).toHaveBeenCalledWith(0);
  });
});
