import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";

export interface Launched {
  app: ElectronApplication;
  page: Page;
  dataDir: string;
}

/** Start the built app (run `pnpm build` first) against a throwaway data folder. */
export async function launch(
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-e2e-")),
): Promise<Launched> {
  // CI on Linux may need Chromium's sandbox switched off (open item O1 in specs/017.../research.md);
  // off by default so local runs keep the real sandbox.
  const sandboxArguments = process.env.SHOPOS_E2E_NO_SANDBOX === "1" ? ["--no-sandbox"] : [];
  const app = await electron.launch({
    args: [...sandboxArguments, path.resolve(__dirname, "../../out/main/index.js")],
    env: { ...process.env, SHOPOS_USER_DATA: dataDir },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app, page, dataDir };
}

export async function addItem(
  page: Page,
  itemInput: { name: string; unit?: string; price: string; qty?: string },
) {
  await page.getByRole("button", { name: "Items", exact: true }).click();
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Item name").fill(itemInput.name);
  if (itemInput.unit && itemInput.unit !== "pcs") {
    await page.getByRole("combobox", { name: "Unit" }).click();
    await page.getByRole("option", { name: itemInput.unit, exact: true }).click();
  }
  await page.getByLabel("Selling price").fill(itemInput.price);
  if (itemInput.qty) await page.getByLabel("Opening quantity").fill(itemInput.qty);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}
