import { expect, test } from "@playwright/test";
import { addItem, launch } from "./launch";

// quickstart.md scenario 1 (spec US1 scenarios 1 to 6)
test("inventory: add, edit, adjust, search, duplicate and decimal rules", async () => {
  const { app, page } = await launch();
  try {
    const names = [
      "PVC Pipe 1 inch",
      "PVC Pipe 2 inch",
      "Elbow 1 inch",
      "Tape",
      "Nail",
      "Screw",
      "Bolt",
      "Nut",
      "Washer",
      "Clamp",
    ];
    for (const [itemIndex, itemName] of names.entries())
      await addItem(page, { name: itemName, price: `${10 + itemIndex}`, qty: `${5 + itemIndex}` });
    await page.getByRole("button", { name: "Items", exact: true }).click();
    await expect(page.getByText("10 items")).toBeVisible();

    // edit price
    await page.getByRole("row", { name: /Tape/ }).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Selling price").fill("99.50");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("row", { name: /Tape/ })).toContainText("₹99.50");

    // adjust stock with a note
    await page
      .getByRole("row", { name: /Nail/ })
      .getByRole("button", { name: "Adjust stock" })
      .click();
    await page.getByLabel("Quantity").fill("10");
    await page.getByLabel("Note").fill("delivery");
    await page.getByRole("button", { name: "Save adjustment" }).click();
    await expect(page.getByRole("row", { name: /Nail/ })).toContainText("19");

    // partial-name search
    await page.getByLabel("Search items by name").fill("pip");
    await expect(page.getByText("2 items")).toBeVisible();
    await page.getByLabel("Search items by name").fill("");

    // duplicate name warning
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByLabel("Item name").fill("tape");
    await page.getByLabel("Selling price").fill("5");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/already exists/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    // decimals: pcs rejects 2.5, metre accepts it
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByLabel("Item name").fill("Wire");
    await page.getByLabel("Selling price").fill("5");
    await page.getByLabel("Opening quantity").fill("2.5");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/whole numbers only/)).toBeVisible();
    await page.getByRole("combobox", { name: "Unit" }).click();
    await page.getByRole("option", { name: "metre", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("row", { name: /Wire/ })).toContainText("2.5");
  } finally {
    await app.close();
  }
});
