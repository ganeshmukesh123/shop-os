import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { addItem, forceQuit, launch } from "./launch";

async function addToBill(page: import("@playwright/test").Page, search: string) {
  await page.getByLabel(/Type 2 or more letters/).fill(search);
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Enter");
}

// quickstart.md scenarios 2 to 4 (spec US2)
test("billing: totals, stock, negative stock, draft recovery, exactly-once save", async () => {
  const first = await launch();
  const { dataDir } = first;
  let { app, page } = first;
  try {
    await addItem(page, { name: "Pipe", price: "100", qty: "10" });
    await addItem(page, { name: "Elbow", price: "20", qty: "50" });
    await addItem(page, { name: "Glue", price: "55.50", qty: "2" });
    await page.getByRole("button", { name: "New bill", exact: true }).click();

    await addToBill(page, "pip");
    await page.keyboard.press("Enter"); // leave quantity, back to search
    await addToBill(page, "elb");
    await page.getByLabel("Qty Elbow").fill("3");
    await page.getByLabel("Rate (₹) Elbow").fill("25");
    await page.getByLabel("Discount Elbow").fill("5");
    await addToBill(page, "glu");
    await page.getByLabel("Qty Glue").fill("5"); // more than the 2 in stock
    await page.getByLabel("Customer name (optional)").fill("Ravi");
    // 100 + (75 - 5) + 277.50 = 447.50, rounded to the rupee (on by default): +0.50, so 448.00 (FR-010a)
    await expect(page.getByText("Round off: +₹0.50")).toBeVisible();
    await expect(page.getByText("Grand total: ₹448.00")).toBeVisible();

    // draft recovery: force-quit before saving, reopen
    await page.waitForTimeout(800);
    await forceQuit(app);
    ({ app, page } = await launch(dataDir));
    await expect(page.getByText("Unsaved bill found")).toBeVisible();
    await page.getByRole("button", { name: "Continue bill" }).click();
    await expect(page.getByText("Grand total: ₹448.00")).toBeVisible();

    await page.getByRole("button", { name: /Save bill/ }).click();
    await expect(page.getByText(/Bill saved: .*000001/)).toBeVisible();
    await expect(page.getByText(/Stock is now below zero/)).toBeVisible(); // negative stock flagged

    // force-quit right after save: the bill exists exactly once
    await forceQuit(app);
    // The test process cannot load the Electron-built better-sqlite3, so read the file with the sqlite3 CLI.
    // The 5 s busy timeout is a backstop; forceQuit already waits for the app to release the file.
    const queryDatabase = (sql: string) =>
      execFileSync("sqlite3", ["-cmd", ".timeout 5000", path.join(dataDir, "shopos.sqlite"), sql])
        .toString()
        .trim();
    expect(queryDatabase("select count(*) from bill")).toBe("1");
    // The screen showed what the bill stores: the cashier collected the saved amount.
    expect(queryDatabase("select subtotal_paise, round_off_paise, total_paise from bill")).toBe(
      "44750|50|44800",
    );
    expect(queryDatabase("select stock_milli from item_variant where display_name='Glue'")).toBe(
      "-3000",
    );

    ({ app, page } = await launch(dataDir));
    await page.getByRole("button", { name: /^Items/ }).click();
    await page.getByLabel("Needs correction").click();
    await expect(page.getByRole("row", { name: /Glue/ })).toBeVisible();
    expect(fs.existsSync(path.join(dataDir, "shopos.sqlite"))).toBe(true);
  } finally {
    await app.close().catch(() => {});
  }
});
