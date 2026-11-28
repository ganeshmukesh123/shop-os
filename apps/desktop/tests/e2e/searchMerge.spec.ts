import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { addItem, forceQuit, launch } from "./launch";

/**
 * Spec 002 quickstart scenario 2 (T053): search by other names and typos, most-sold first, the
 * duplicate warning, a shared barcode, and a merge that is reversed. SC-002's 50,000-variant timing
 * is the integration benchmark (searchBenchmark.test.ts); here each search is timed on the screen.
 */
const SEARCH_LIMIT_MS = 1_000;

const itemRow = (page: Page, name: string) =>
  page.getByRole("row").filter({ has: page.getByRole("rowheader", { name, exact: true }) });

async function openRowAction(page: Page, item: string, action: string) {
  await page.getByRole("button", { name: "Items", exact: true }).click();
  await itemRow(page, item).getByRole("button", { name: action, exact: true }).click();
}

async function sell(page: Page, query: string, option: RegExp) {
  await page.getByRole("button", { name: "New bill", exact: true }).last().click(); // after a save, the saved bill's own button
  await page.getByLabel(/Type 2 or more letters/).fill(query);
  await page.getByRole("option", { name: option }).click();
  await page.getByRole("button", { name: /Save bill/ }).click();
  await expect(page.getByText(/Bill saved/)).toBeVisible();
}

test("search: other names, typos and most-sold first", async () => {
  const { app, page } = await launch();
  try {
    await addItem(page, { name: "Elbow 1 in", price: "45", qty: "20" });
    await addItem(page, { name: "Elbow 1 in grey", price: "50", qty: "20" });
    await openRowAction(page, "Elbow 1 in", "Names and codes");
    for (const name of ["bend", "कोहनी"]) {
      await page.getByLabel("New search name").fill(name);
      await page.getByRole("button", { name: "Add name" }).click();
    }
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // Step 1: found by each name and by a typo
    await page.getByRole("button", { name: "New bill", exact: true }).click();
    for (const query of ["bend", "कोहनी", "elbo", "elbwo"]) {
      const started = Date.now();
      await page.getByLabel(/Type 2 or more letters/).fill(query);
      await expect(page.getByRole("option", { name: /Elbow 1 in/ }).first()).toBeVisible();
      const searchMs = Date.now() - started;
      console.log(`SC-002: "${query}" found on screen in ${searchMs} ms`);
      expect(searchMs).toBeLessThan(SEARCH_LIMIT_MS);
    }
    await page.getByLabel(/Type 2 or more letters/).fill("");

    // Step 2: sell the grey one 3 times; it then ranks first
    for (let sale = 0; sale < 3; sale += 1) {
      await sell(page, "grey", /Elbow 1 in grey/);
    }
    await page.getByRole("button", { name: "New bill", exact: true }).last().click();
    await page.getByLabel(/Type 2 or more letters/).fill("elbow");
    await expect(page.getByRole("option").first()).toContainText("Elbow 1 in grey");
  } finally {
    await forceQuit(app);
  }
});

test("duplicates, a shared barcode, and a merge that is reversed", async () => {
  const { app, page, dataDir } = await launch();
  try {
    // Step 4: one code on two items opens a chooser and one data issue
    await addItem(page, { name: "Tape red", price: "20", qty: "5" });
    await addItem(page, { name: "Tape blue", price: "20", qty: "5" });
    for (const tape of ["Tape red", "Tape blue"]) {
      await openRowAction(page, tape, "Names and codes");
      await page.getByLabel("New barcode").fill("8901234567890");
      await page.getByRole("button", { name: "Add code" }).click();
      await page.getByRole("button", { name: "Save", exact: true }).click();
    }
    await expect(page.getByText(/8901234567890 is also on Tape red/)).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "New bill", exact: true }).click();
    await page.getByLabel(/Type 2 or more letters/).fill("8901234567890");
    await page.keyboard.press("Enter");
    const chooser = page.getByRole("dialog", {
      name: "Code 8901234567890 is on more than one item",
    });
    await chooser.getByRole("button", { name: /Tape blue/ }).click();
    await expect(page.getByRole("row", { name: /Tape blue/ })).toHaveCount(1);
    await page.getByRole("button", { name: "Items", exact: true }).click();
    await page.getByRole("button", { name: "Data issues" }).click();
    await expect(page.getByRole("rowheader", { name: "Shared barcode" })).toHaveCount(1);
    await page.keyboard.press("Escape");

    // Step 5: B (4, one sold) into A (10); then reverse it
    await addItem(page, { name: "Pipe A", price: "120", qty: "10" });
    await addItem(page, { name: "Pipe B", price: "120", qty: "4" });
    await sell(page, "Pipe B", /Pipe B/);
    await openRowAction(page, "Pipe B", "Merge");
    await page.getByLabel("Find the item to keep").fill("Pipe A");
    await page.getByRole("radio", { name: "Pipe A" }).click();
    await expect(
      page.getByText("3 pcs move to Pipe A, which will then have 13 pcs."),
    ).toBeVisible();
    await page.getByRole("textbox", { name: "Reason" }).fill("Entered twice");
    await page.getByRole("button", { name: "Merge", exact: true }).last().click();
    await expect(itemRow(page, "Pipe A")).toContainText("13");

    await page.getByRole("button", { name: "Merge log" }).click();
    const merge = page.getByRole("row", { name: /Pipe B into Pipe A/ });
    await expect(merge).toContainText("30 days left");
    await merge.getByRole("button", { name: "Reverse" }).click();
    await merge.getByLabel("Reason for reversing").fill("Merged by mistake");
    await merge.getByRole("button", { name: "Confirm reverse" }).click();
    await expect(merge).toContainText("Reversed");
    await page.keyboard.press("Escape");
    await expect(itemRow(page, "Pipe A")).toContainText("10");
    await expect(itemRow(page, "Pipe B")).toContainText("3");
  } finally {
    await forceQuit(app);
  }

  // SC-006: nothing saved changed; B's sale still points at B, and both are active again
  const queryDatabase = (sql: string) =>
    execFileSync("sqlite3", ["-cmd", ".timeout 5000", path.join(dataDir, "shopos.sqlite"), sql])
      .toString()
      .trim();
  expect(
    queryDatabase(
      "select v.display_name from bill_line l join item_variant v on v.id = l.variant_id where v.display_name like 'Pipe%'",
    ),
  ).toBe("Pipe B");
  expect(
    queryDatabase(
      "select group_concat(display_name || ':' || is_active || ':' || coalesce(merged_into_id, '-'), ',') from (select * from item_variant where display_name like 'Pipe%' order by display_name)",
    ),
  ).toBe("Pipe A:1:-,Pipe B:1:-");
  expect(
    queryDatabase(
      "select group_concat(action, ',') from (select action from item_merge_log order by rowid)",
    ),
  ).toBe("merge,reverse");
});
