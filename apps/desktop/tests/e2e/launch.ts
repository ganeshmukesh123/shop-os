import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";

export interface Launched {
  app: ElectronApplication;
  page: Page;
  dataDir: string;
}

/**
 * Start the built app (run `pnpm build` first) against a throwaway data folder.
 * Set SHOPOS_E2E_EXECUTABLE to the packaged app's binary (see `pnpm test:e2e:packaged`, which uses the `package:e2e` flavour) to run the
 * same scenarios against the installer's output instead of `out/main/index.js`.
 */
export async function launch(
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-e2e-")),
): Promise<Launched> {
  // CI on Linux may need Chromium's sandbox switched off (open item O1 in specs/017.../research.md);
  // off by default so local runs keep the real sandbox.
  const sandboxArguments = process.env.SHOPOS_E2E_NO_SANDBOX === "1" ? ["--no-sandbox"] : [];
  const packagedExecutable = process.env.SHOPOS_E2E_EXECUTABLE;
  const app = await electron.launch({
    executablePath: packagedExecutable,
    args: [
      ...sandboxArguments,
      ...(packagedExecutable ? [] : [path.resolve(__dirname, "../../out/main/index.js")]),
    ],
    env: { ...process.env, SHOPOS_USER_DATA: dataDir },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app, page, dataDir };
}

/**
 * Kill the app the way a power cut or crash would (exit code 1, no clean shutdown), and resolve only
 * once the process has really gone. `app.exit` returns as soon as the request is sent; reading the
 * database before the process ends fails with "database is locked" on slower machines (CI).
 */
export async function forceQuit(app: ElectronApplication): Promise<void> {
  const appProcess = app.process();
  const hasExited = appProcess.exitCode !== null || appProcess.signalCode !== null;
  if (hasExited) {
    return;
  }
  const exited = new Promise<void>((resolve) => appProcess.once("exit", () => resolve()));
  // The page disappears mid-call, so the evaluate itself may reject; the exit event is what counts.
  await app.evaluate(({ app: electronApp }) => electronApp.exit(1)).catch(() => {});
  await exited;
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
