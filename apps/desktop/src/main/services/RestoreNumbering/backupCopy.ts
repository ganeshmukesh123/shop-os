import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

/** Open a database file, run `readDatabase` on it, and always close it again. */
export function readDatabaseFile<Result>(
  databaseFile: string,
  readDatabase: (database: Database.Database) => Result,
): Result {
  const database = new Database(databaseFile, { fileMustExist: true });
  try {
    return readDatabase(database);
  } finally {
    database.close();
  }
}

/**
 * Open a throwaway copy of the backup in the system temp folder, so the backup itself is never
 * touched. The copy is made without blocking the window: a shop's backup can be tens of megabytes.
 */
export async function withBackupCopy<Result>(
  backupFile: string,
  readCopy: (copyDatabase: Database.Database) => Result,
): Promise<Result> {
  const copyFolder = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shopos-plan-"));
  // The folder holds a full copy of the shop's data, so it goes even when the copy or open fails.
  try {
    const copyFile = path.join(copyFolder, "backup.sqlite");
    await fs.promises.copyFile(backupFile, copyFile);
    return readDatabaseFile(copyFile, readCopy);
  } finally {
    await fs.promises.rm(copyFolder, { recursive: true, force: true });
  }
}
