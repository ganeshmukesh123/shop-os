import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, type Connection } from "../../src/main/db/connection";
import { ensureSeed, type Ctx } from "../../src/main/db/seed";

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS = path.resolve(here, "../../drizzle");

export interface TestDb extends Connection {
  ctx: Ctx;
}

/** In-memory SQLite with every migration applied and the first-run seed done. */
export function createTestDb(): TestDb {
  const conn = openDatabase(":memory:", { migrationsFolder: MIGRATIONS });
  const ctx = ensureSeed(conn.db);
  return { ...conn, ctx };
}
