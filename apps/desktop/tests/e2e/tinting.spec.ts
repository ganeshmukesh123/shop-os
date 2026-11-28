import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { forceQuit, launch } from "./launch";

/**
 * Spec 002 T068, quickstart scenario 3 steps 1, 3, 4 and 5 on the built app. Setup (the Royale
 * base, Blue and Black colorants, the 4 L charge) goes through the app's own typed bridge, the
 * same window.shopos the screens use. SC-003 is timed from the search to the saved bill.
 */
const SC_003_LIMIT_MS = 90 * 1000;
const PAINT = {
  petroleumClass: "B",
  tradeLabel: null,
  warrantyMonths: null,
  isSerialTracked: false,
} as const;

async function setUpPaintShop(page: Page) {
  await page.evaluate(async (paint) => {
    const api = window.shopos;
    const can = (base_type: string, pack_size: string, declaredQtyMilli: number) => ({
      ...paint,
      axes: { base_type, pack_size },
      baseUom: "pcs",
      allowDecimal: false,
      sellingPricePaise: 145_000,
      openingQtyMilli: 10_000,
      declaredQtyMilli,
      declaredUom: "litre",
      sealedPackOnly: true,
    });
    const colorant = {
      ...paint,
      axes: {},
      baseUom: "ml",
      allowDecimal: true,
      sellingPricePaise: 300,
      openingQtyMilli: 1_000_000,
      declaredQtyMilli: 1_000_000,
      declaredUom: "ml",
      sealedPackOnly: false,
    };
    await api["families.create"]({
      family: {
        name: "Royale",
        kind: "base_paint",
        spec: {},
        axisKeys: ["base_type", "pack_size"],
      },
      variants: [can("Pastel", "4 L", 4_000), can("White", "1 L", 1_000)],
    });
    for (const name of ["Blue", "Black"]) {
      await api["families.create"]({
        family: { name, kind: "colorant", spec: {}, axisKeys: [] },
        variants: [colorant],
      });
    }
    await api["tint.charges.save"]({
      rules: [{ declaredQtyMilli: 4_000, declaredUom: "litre", chargePaise: 6_000 }],
    });
  }, PAINT);
}

async function startTintedBill(page: Page, can: string) {
  await page.getByRole("button", { name: "New bill", exact: true }).last().click();
  await page.getByLabel("Customer name (optional)").fill("Sharma");
  await page.getByLabel(/Type 2 or more letters/).fill("royale");
  await page.getByRole("option", { name: /Royale/ }).click();
  await page.getByRole("radio", { name: can }).click();
}

async function makeCustomShade(page: Page, name: string, colorants: [string, string][]) {
  await page.getByRole("button", { name: "Custom shade" }).click();
  await page.getByLabel("Shade name").fill(name);
  for (const [colorant, ml] of colorants) {
    await page.getByLabel("Find a colorant").fill(colorant);
    await page.getByRole("button", { name: `Add: ${colorant}` }).click();
    await page.getByLabel(`ml of ${colorant}`).fill(ml);
  }
  await page.getByRole("button", { name: "Save shade" }).click();
}

async function saveBill(page: Page): Promise<string> {
  await page.getByRole("button", { name: /Save bill/ }).click();
  const saved = page.getByText(/Bill saved: /);
  await expect(saved).toBeVisible();
  return (await saved.textContent())!.match(/\S+$/)![0];
}

test("tinting: bill Sky Blue, a custom shade, same as last time, and cancel", async () => {
  const { app, page, dataDir } = await launch();
  let firstBill = "";
  try {
    await setUpPaintShop(page);

    // Step 1: Sky Blue in Pastel 4 L for Sharma (made at the counter: the library starts empty)
    const started = Date.now();
    await startTintedBill(page, "Royale Pastel 4 L");
    await makeCustomShade(page, "Sky Blue", [
      ["Blue", "12.5"],
      ["Black", "0.75"],
    ]);
    await expect(page.getByText("Blue 12.5 ml")).toBeVisible();
    await expect(page.getByText("₹1,450.00 + tint ₹60.00 = ₹1,510.00")).toBeVisible();
    await page.getByRole("button", { name: "Add to bill" }).click();
    firstBill = await saveBill(page);
    const billMs = Date.now() - started;
    console.log(`SC-003: tinted can billed in ${billMs} ms of screen time`);
    expect(billMs).toBeLessThan(SC_003_LIMIT_MS);
    await expect(page.getByText("Non-returnable (tinted)").first()).toBeVisible();

    // Step 3: White 1 L has no Sky Blue formula; a custom shade with 5 ml Blue
    await startTintedBill(page, "Royale White 1 L");
    await page.getByLabel("Find a shade").fill("sky");
    await page.getByRole("radio", { name: /Sky Blue/ }).click();
    await expect(page.getByText("No formula for this pack")).toBeVisible();
    await makeCustomShade(page, "Sharma white", [["Blue", "5"]]);
    await page.getByRole("button", { name: "Add to bill" }).click();
    await saveBill(page);

    // Step 4: Sharma's shades are listed; one tap adds the saved Sky Blue mix
    await page.getByRole("button", { name: "New bill", exact: true }).last().click();
    await page.getByLabel("Customer name (optional)").fill("Sharma");
    await page.getByRole("button", { name: /Sky Blue, Royale Pastel 4 L/ }).click();
    await expect(page.getByText("Sky Blue: Blue 12.5 ml, Black 0.75 ml")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sharma white, Royale White 1 L/ }),
    ).toBeVisible();

    // Step 5: cancel the first tinted bill
    await page.getByRole("button", { name: "Bills", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(`${firstBill.slice(-6)}$`) }).click();
    await page.getByRole("button", { name: "Cancel bill" }).click();
    await page.getByRole("textbox", { name: "Reason (required)" }).fill("Wrong shade");
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel bill" }).click();
    await expect(page.getByText(/Reason: Wrong shade\./)).toBeVisible();
  } finally {
    await forceQuit(app);
  }

  // Bills 1 (cancelled) and 2 stand: Pastel back to 10, White 9, Blue 1000 - 5 ml, Black 1000 ml
  const queryDatabase = (sql: string) =>
    execFileSync("sqlite3", ["-cmd", ".timeout 5000", path.join(dataDir, "shopos.sqlite"), sql])
      .toString()
      .trim();
  expect(
    queryDatabase(
      "select group_concat(display_name || '=' || stock_milli, ',') from (select display_name, stock_milli from item_variant where display_name in ('Royale Pastel 4 L', 'Royale White 1 L', 'Blue', 'Black') order by display_name)",
    ),
  ).toBe("Black=1000000,Blue=995000,Royale Pastel 4 L=10000,Royale White 1 L=9000");
  expect(queryDatabase("select count(*) from bill_line where is_returnable = 0")).toBe("2");
});
