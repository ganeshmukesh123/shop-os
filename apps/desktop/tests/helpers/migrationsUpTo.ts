import fs from "node:fs";
import path from "node:path";
import { makeTempFolder } from "./appStateFixture";
import { MIGRATIONS } from "./testDb";

/**
 * A copy of the real migrations folder whose journal lists only the first `migrationCount`
 * migrations (0000 is the first). Opening a database with it stops the upgrade there.
 */
export function migrationsFolderUpTo(migrationCount: number): string {
  const folder = makeTempFolder(`shopos-migrations-${migrationCount}-`);
  fs.cpSync(MIGRATIONS, folder, { recursive: true });
  const journalFile = path.join(folder, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalFile, "utf8")) as { entries: unknown[] };
  journal.entries = journal.entries.slice(0, migrationCount);
  fs.writeFileSync(journalFile, JSON.stringify(journal));
  return folder;
}
