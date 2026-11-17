import type Database from "better-sqlite3";
import type { SQL, TablesRelationalConfig } from "drizzle-orm";
import { BetterSQLiteSession } from "drizzle-orm/better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";

/** Drizzle 0.45's sync migrator owns BEGIN/COMMIT and rolls back if session.run throws. */
class ValidatedMigrationSession extends BetterSQLiteSession<
  Record<string, unknown>,
  TablesRelationalConfig
> {
  constructor(
    private readonly sqlite: Database.Database,
    private readonly migrationDialect: SQLiteSyncDialect,
  ) {
    super(sqlite, migrationDialect, undefined);
  }

  override run(query: SQL): Database.RunResult {
    const isCommit = this.migrationDialect.sqlToQuery(query).sql === "COMMIT";
    if (isCommit) {
      const brokenReferences = this.sqlite.pragma("foreign_key_check") as unknown[];
      const hasBrokenReferences = brokenReferences.length > 0;
      if (hasBrokenReferences) {
        throw new Error(`A migration left ${brokenReferences.length} broken reference(s)`);
      }
    }
    return super.run(query);
  }
}

/** Keep Drizzle's migration ordering, hashes, journal and rollback, validating before its commit. */
export function migrateValidated(sqlite: Database.Database, migrationsFolder: string): void {
  const config = { migrationsFolder };
  const migrations = readMigrationFiles(config);
  const dialect = new SQLiteSyncDialect();
  dialect.migrate(migrations, new ValidatedMigrationSession(sqlite, dialect), config);
}
