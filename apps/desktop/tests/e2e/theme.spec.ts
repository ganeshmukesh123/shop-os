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
