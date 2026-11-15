import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { CoreError } from "@shopos/core";
import { applyConnectionPragmas } from "./connection";

/**
 * Start-up safety (spec 001 research D15, task T091).
 *
 *   open file --> integrity_check --> pending migration and shop data?
 *                   | fails              | yes: online backup to pre-migration-backups/
 *                   v                    v
 *             DATABASE_CORRUPT      migrate (a bad migration can be undone from the copy)
 */

export const PRE_MIGRATION_BACKUPS_KEPT = 5;
const PRE_MIGRATION_FILE_PREFIX = "shopos-pre-migrate-";
const MIGRATIONS_TABLE = "__drizzle_migrations";

interface IJournalEntry {
  when: number;
}

const padTwo = (numberValue: number) => String(numberValue).padStart(2, "0");

function formatStamp(backupTime: Date): string {
  const datePart = `${backupTime.getFullYear()}${padTwo(backupTime.getMonth() + 1)}${padTwo(backupTime.getDate())}`;
  const timePart = `${padTwo(backupTime.getHours())}${padTwo(backupTime.getMinutes())}${padTwo(backupTime.getSeconds())}`;
  return `${datePart}-${timePart}`;
}

function readIntegrityResult(sqlite: Database.Database): string {
  try {
    return String(sqlite.pragma("integrity_check", { simple: true }));
  } catch (caughtError) {
    return caughtError instanceof Error ? caughtError.message : String(caughtError);
  }
}

/** Opens the shop database and refuses to continue if SQLite reports damage. */
export function openCheckedSqlite(databasePath: string): Database.Database {
  const sqlite = new Database(databasePath);
  const integrityResult = readIntegrityResult(sqlite);
  const isDamaged = integrityResult !== "ok";
  if (isDamaged) {
    sqlite.close();
    throw new CoreError(
      "DATABASE_CORRUPT",
      `The shop database is damaged (${integrityResult}). Restore it from a backup.`,
    );
  }
  applyConnectionPragmas(sqlite);
  return sqlite;
}

function countTables(sqlite: Database.Database): number {
  const tableCountRow = sqlite
    .prepare(
      "select count(*) as tableCount from sqlite_master where type = 'table' and name not like 'sqlite_%'",
    )
    .get() as { tableCount: number };
  return tableCountRow.tableCount;
}

function readNewestAppliedMillis(sqlite: Database.Database): number {
  const migrationsTableRow = sqlite
    .prepare("select name from sqlite_master where type = 'table' and name = ?")
    .get(MIGRATIONS_TABLE);
  const hasMigrationsTable = migrationsTableRow !== undefined;
  if (hasMigrationsTable) {
    const newestRow = sqlite
      .prepare(`select max(created_at) as newestMillis from ${MIGRATIONS_TABLE}`)
      .get() as { newestMillis: number | null };
    return Number(newestRow.newestMillis ?? 0);
  }
  return 0;
}

function readNewestJournalMillis(migrationsFolder: string): number {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as { entries: IJournalEntry[] };
  return Math.max(0, ...journal.entries.map((journalEntry) => journalEntry.when));
}

/** True when the file already holds shop data and at least one migration has not run on it. */
export function needsPreMigrationBackup(
  sqlite: Database.Database,
  migrationsFolder: string,
): boolean {
  const hasShopData = countTables(sqlite) > 0;
  const hasPendingMigration =
    readNewestJournalMillis(migrationsFolder) > readNewestAppliedMillis(sqlite);
  return hasShopData && hasPendingMigration;
}

function pruneOldCopies(backupFolder: string): void {
  const copyNames = fs
    .readdirSync(backupFolder)
    .filter((fileName) => fileName.startsWith(PRE_MIGRATION_FILE_PREFIX))
    .sort();
  const namesToRemove = copyNames.slice(
    0,
    Math.max(0, copyNames.length - PRE_MIGRATION_BACKUPS_KEPT),
  );
  namesToRemove.forEach((fileName) => fs.rmSync(path.join(backupFolder, fileName)));
}

/** Copies the live database with SQLite's online backup API before migrating. Returns the copy's path. */
export async function backupBeforeMigrating(
  sqlite: Database.Database,
  backupFolder: string,
  backupTime: Date,
): Promise<string> {
  fs.mkdirSync(backupFolder, { recursive: true });
  const backupPath = path.join(
    backupFolder,
    `${PRE_MIGRATION_FILE_PREFIX}${formatStamp(backupTime)}.sqlite`,
  );
  await sqlite.backup(backupPath);
  pruneOldCopies(backupFolder);
  return backupPath;
}
