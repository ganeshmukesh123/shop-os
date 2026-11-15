import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAppState, type IAppState } from "../../src/main/app/appState";
import { SettingsRepository } from "../../src/main/repositories/SettingsRepository";
import { BackupService } from "../../src/main/services/BackupService";
import { createTestDb, type TestDb } from "./testDb";

export interface IAppStateFixture {
  state: IAppState;
  testDb: TestDb;
  backupFolder: string;
}

export const makeTempFolder = (prefix = "shopos-app-") =>
  fs.mkdtempSync(path.join(os.tmpdir(), prefix));

/** A running-app state on an in-memory database. Pass `chooseBackupFolder: false` for a shop with no backup folder. */
export function buildAppStateFixture(
  options: { chooseBackupFolder?: boolean; withBackup?: boolean } = {},
): IAppStateFixture {
  const testDb = createTestDb();
  const backupFolder = makeTempFolder("shopos-backups-");
  const settings = new SettingsRepository(testDb.db, testDb.ctx);
  if (options.chooseBackupFolder !== false) settings.update({ ...settings.get(), backupFolder });
  const state = createAppState();
  state.connection = { db: testDb.db, sqlite: testDb.sqlite };
  state.context = testDb.ctx;
  if (options.withBackup !== false)
    state.backup = new BackupService(testDb.sqlite, testDb.db, testDb.ctx);
  return { state, testDb, backupFolder };
}
