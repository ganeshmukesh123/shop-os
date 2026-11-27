import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { launch } from "./launch";

test("document colour scheme follows the chosen appearance", async () => {
  const { app, page } = await launch();
  try {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const documentRoot = page.locator("html");

    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(documentRoot).toHaveCSS("color-scheme", "dark");

    await page.reload();
    await expect(documentRoot).toHaveCSS("color-scheme", "dark");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("radio", { name: "Light" }).click();
    await expect(documentRoot).toHaveCSS("color-scheme", "light");
    await expect(documentRoot).not.toHaveAttribute("style", /color-scheme/);
  } finally {
    await app.close();
  }
});

// Spec 018 T035: the choice lives in the shop database, so a new page origin (PR C), whose
// localStorage starts empty, keeps it; and an old localStorage choice is copied in once.
function readSavedTheme(dataDir: string): string {
  const databaseFile = path.join(dataDir, "shopos.sqlite");
  const statement = "select coalesce(theme, 'NULL') from shop_profile";
  return execFileSync("sqlite3", [databaseFile, statement], { encoding: "utf8" }).trim();
}

test("the theme survives losing the page's local storage", async () => {
  const { app, page, dataDir } = await launch();
  try {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect.poll(() => readSavedTheme(dataDir)).toBe("dark");

    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  } finally {
    await app.close();
  }
});

test("an old local-storage theme is copied into a database that has none", async () => {
  const firstStart = await launch();
  await firstStart.page.evaluate(() => {
    window.localStorage.setItem("shopos.themePreference", "dark");
  });
  await firstStart.app.close();
  // A counter that last ran before migration 0015: the database has no theme yet.
  const databaseFile = path.join(firstStart.dataDir, "shopos.sqlite");
  execFileSync("sqlite3", [databaseFile, "update shop_profile set theme = null"]);

  const { app, page, dataDir } = await launch(firstStart.dataDir);
  try {
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    await expect.poll(() => readSavedTheme(dataDir)).toBe("dark");
  } finally {
    await app.close();
  }
});
