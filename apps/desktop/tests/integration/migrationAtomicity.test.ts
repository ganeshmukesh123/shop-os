import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { migrateConnection } from "../../src/main/db/connection";
import { makeTempFolder } from "../helpers/appStateFixture";

function createMigrations(sql: string): string {
  const folder = makeTempFolder("shopos-migration-atomicity-");
  fs.mkdirSync(path.join(folder, "meta"));
  fs.writeFileSync(
    path.join(folder, "meta/_journal.json"),
    JSON.stringify({
      entries: [{ idx: 0, when: 1, tag: "0000_test", breakpoints: true }],
    }),
  );
  fs.writeFileSync(path.join(folder, "0000_test.sql"), sql);
  return folder;
}

const CREATE_TABLES = `
  CREATE TABLE parent (id INTEGER PRIMARY KEY);
  --> statement-breakpoint
  CREATE TABLE child (parent_id INTEGER REFERENCES parent(id));
  --> statement-breakpoint
`;

describe("migration atomicity", () => {
  it("rolls back schema, rows and journal when a migration creates a broken reference, then retries", () => {
    const folder = createMigrations(`${CREATE_TABLES} INSERT INTO child VALUES (1);`);
    const databasePath = path.join(folder, "shopos.sqlite");
    const sqlite = new Database(databasePath);
    try {
      expect(() => migrateConnection(sqlite, folder)).toThrow(/broken reference/);
      expect(sqlite.inTransaction).toBe(false);
      expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(sqlite.prepare("SELECT * FROM __drizzle_migrations").all()).toEqual([]);
      expect(
        sqlite.prepare("SELECT name FROM sqlite_master WHERE name IN ('parent', 'child')").all(),
      ).toEqual([]);

      const reopened = new Database(databasePath);
      expect(reopened.prepare("SELECT * FROM __drizzle_migrations").all()).toEqual([]);
      expect(reopened.prepare("SELECT name FROM sqlite_master WHERE name = 'child'").all()).toEqual(
        [],
      );
      reopened.close();

      fs.writeFileSync(
        path.join(folder, "0000_test.sql"),
        `${CREATE_TABLES} INSERT INTO parent VALUES (1);`,
      );
      migrateConnection(sqlite, folder);
      expect(sqlite.prepare("SELECT * FROM parent").all()).toEqual([{ id: 1 }]);
      expect(sqlite.prepare("SELECT * FROM __drizzle_migrations").all()).toHaveLength(1);
    } finally {
      sqlite.close();
      fs.rmSync(folder, { recursive: true });
    }
  });

  it("rejects broken references even when no migrations are pending", () => {
    const sqlite = new Database(":memory:");
    const folder = createMigrations(`${CREATE_TABLES} INSERT INTO parent VALUES (1);`);
    try {
      migrateConnection(sqlite, folder);
      sqlite.pragma("foreign_keys = OFF");
      sqlite.prepare("INSERT INTO child VALUES (2)").run();
      expect(() => migrateConnection(sqlite, folder)).toThrow(/broken reference/);
      expect(sqlite.inTransaction).toBe(false);
      expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(sqlite.prepare("SELECT * FROM __drizzle_migrations").all()).toHaveLength(1);
    } finally {
      sqlite.close();
      fs.rmSync(folder, { recursive: true });
    }
  });
});
