import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;
/** A database handle or an open transaction; repositories accept either. */
export type Handle = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

export interface Connection {
  sqlite: Database.Database;
  db: DB;
}

export interface OpenOptions {
  /** Folder holding the generated SQL migrations. */
  migrationsFolder: string;
  /**
   * Encryption hook (research D4). Not used in the MVP: SQLCipher is deferred, so a key here
   * is ignored. This is the single place a key would be applied.
   */
  encryptionKey?: string;
}

/** WAL for files (not for in-memory test databases) and foreign keys on. */
export function applyConnectionPragmas(sqlite: Database.Database): void {
  // if (opts.encryptionKey) sqlite.pragma(`key='${opts.encryptionKey}'`); // SQLCipher builds only
  const isFileDatabase = sqlite.memory === false;
  if (isFileDatabase) {
    sqlite.pragma("journal_mode = WAL");
  }
  sqlite.pragma("foreign_keys = ON");
}

/** Run pending migrations on an open SQLite handle and wrap it for Drizzle. */
export function migrateConnection(sqlite: Database.Database, migrationsFolder: string): Connection {
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return { sqlite, db };
}

/** Open (or create) the database, set WAL + foreign keys, and run pending migrations. */
export function openDatabase(file: string, opts: OpenOptions): Connection {
  const sqlite = new Database(file);
  applyConnectionPragmas(sqlite);
  return migrateConnection(sqlite, opts.migrationsFolder);
}
