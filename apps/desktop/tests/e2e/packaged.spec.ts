import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { addItem, launch } from "./launch";

const MIGRATIONS_FOLDER = path.resolve(__dirname, "../../drizzle");

// Task T007 (spec 001): SQLite opens, migrates and keeps a row in the PACKAGED app.
// Runs only against an installer's output: `pnpm test:e2e:packaged` sets SHOPOS_E2E_EXECUTABLE.
test.skip(!process.env.SHOPOS_E2E_EXECUTABLE, "needs the packaged app (SHOPOS_E2E_EXECUTABLE)");

function queryDatabase(databaseFile: string, statement: string): string {
  return execFileSync("sqlite3", [databaseFile, statement], { encoding: "utf8" }).trim();
}

function countJournalMigrations(): number {
  const journalText = fs.readFileSync(
    path.join(MIGRATIONS_FOLDER, "meta", "_journal.json"),
    "utf8",
  );
  return (JSON.parse(journalText) as { entries: unknown[] }).entries.length;
}

test("packaged app: is packaged, finds its migrations, migrates and stores a row", async () => {
  const { app, page, dataDir } = await launch();
  try {
    const isPackaged = await app.evaluate(({ app: electronApp }) => electronApp.isPackaged);
    const resourcesPath = await app.evaluate(() => process.resourcesPath);
    expect(isPackaged).toBe(true);
    expect(fs.existsSync(path.join(resourcesPath, "drizzle", "meta", "_journal.json"))).toBe(true);

    await addItem(page, { name: "Packaged Pipe", price: "100", qty: "10" });
    await page.getByRole("button", { name: "Items", exact: true }).click();
    await expect(page.getByRole("row", { name: /Packaged Pipe/ })).toBeVisible();

    const databaseFile = path.join(dataDir, "shopos.sqlite");
    expect(fs.existsSync(databaseFile)).toBe(true);
    expect(queryDatabase(databaseFile, "select count(*) from __drizzle_migrations")).toBe(
      String(countJournalMigrations()),
    );
    expect(queryDatabase(databaseFile, "select count(*) from stock_movement")).toBe("1");
    expect(queryDatabase(databaseFile, "pragma integrity_check")).toBe("ok");
  } finally {
    await app.close();
  }
});
