import { expect, test } from "@playwright/test";
import { forceQuit, launch } from "./launch";

/**
 * Spec 002 quickstart scenario 1, steps 1 to 3 (T040): create "PVC Pipe Supreme" with 3 sizes x
 * 2 classes, untick "1 in x 4 kg", save; then on a new bill find the family and add
 * "0.75 in x 6 kg" from its grid with the arrow keys and Enter. SC-001 is timed (under 2 minutes):
 * this measures the screens' own speed, not a person typing.
 */
const SIZES = ["0.5 in", "0.75 in", "1 in"];
const CLASSES = ["4 kg", "6 kg"];
const KEPT = SIZES.flatMap((size) => CLASSES.map((pipeClass) => `${size} ${pipeClass}`)).filter(
  (combination) => combination !== "1 in 4 kg",
);
const SC_001_LIMIT_MS = 2 * 60 * 1000;

test("families: create a family of 5 variants and bill one from its grid", async () => {
  const { app, page } = await launch();
  try {
    await page.getByRole("button", { name: "Items", exact: true }).click();
    const started = Date.now();
    await page.getByRole("button", { name: "New family" }).click();
    const form = page.getByRole("dialog", { name: "New item family" });
    await form.getByRole("textbox", { name: "Family name" }).fill("PVC Pipe Supreme");
    await form.getByRole("combobox", { name: "Unit" }).click();
    await page.getByRole("option", { name: "Pieces" }).click();
    await form.getByRole("checkbox", { name: "Size", exact: true }).click();
    await form.getByRole("checkbox", { name: "Class", exact: true }).click();
    await form.getByLabel("Values for Size, separated by commas").fill(SIZES.join(", "));
    await form.getByLabel("Values for Class, separated by commas").fill(CLASSES.join(", "));

    // Step 2: a fifth attribute is refused, with the reason
    for (const extra of ["Brand", "Length", "Colour"]) {
      await form.getByRole("checkbox", { name: extra, exact: true }).click();
    }
    await expect(form.getByText(/at most 4 attributes/)).toBeVisible();
    for (const extra of ["Brand", "Length"]) {
      await form.getByRole("checkbox", { name: extra, exact: true }).click();
    }

    await form.getByRole("button", { name: "Show combinations" }).click();
    await expect(form.getByRole("checkbox", { name: /^Keep / })).toHaveCount(6);
    await form.getByRole("checkbox", { name: "Keep 1 in 4 kg" }).click();
    for (const combination of KEPT) {
      await form.getByLabel(`Price (₹) for ${combination}`).fill("120");
      await form.getByLabel(`Opening stock (pcs) for ${combination}`).fill("10");
    }
    await form.getByRole("button", { name: "Save family" }).click();
    await expect(form).toBeHidden();
    const createMs = Date.now() - started;
    console.log(`SC-001: family with ${KEPT.length} variants created in ${createMs} ms`);
    expect(createMs).toBeLessThan(SC_001_LIMIT_MS);

    // Step 3: the bill search shows the family once; Enter opens the grid
    await page.getByRole("button", { name: "New bill", exact: true }).click();
    await page.getByLabel(/Type 2 or more letters/).fill("supreme");
    await expect(page.getByRole("option", { name: /PVC Pipe Supreme/ })).toHaveCount(1);
    await page.keyboard.press("Enter");
    const grid = page.getByRole("dialog", { name: "Choose from PVC Pipe Supreme" });
    await expect(grid.getByRole("rowheader", { name: "0.75 in" })).toBeVisible();
    await expect(grid.getByText("Not stocked")).toHaveCount(1);
    await grid.getByRole("button", { name: /0\.5 in 4 kg/ }).focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");

    await expect(grid).toBeHidden();
    await expect(
      page.getByRole("rowheader", { name: /PVC Pipe Supreme 0\.75 in 6 kg/ }),
    ).toBeVisible();
  } finally {
    await forceQuit(app);
  }
});
