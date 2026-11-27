import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { forceQuit, launch } from "./launch";

/** Save a bill the way the New bill screen does, through the same command; returns its number. */
async function saveBill(page: Page, customerName: string, quantityMilli: number) {
  return page.evaluate(
    async ({ customer, quantity }) => {
      const itemsResult = await window.shopos["items.list"]({ limit: 10, offset: 0 });
      if (!itemsResult.ok) throw new Error(itemsResult.message);
      const savedResult = await window.shopos["bills.save"]({
        clientBillId: crypto.randomUUID(),
        customerName: customer,
        paymentMode: "cash",
        billDiscountPaise: 0,
        lines: [
          {
            itemId: itemsResult.data.items[0]!.id,
            quantityMilli: quantity,
            ratePaise: 10_000,
            lineDiscountPaise: 0,
          },
        ],
      });
      if (!savedResult.ok) throw new Error(savedResult.message);
      return savedResult.data.bill.number;
    },
    { customer: customerName, quantity: quantityMilli },
  );
}

const rowFor = (page: Page, text: string) => page.getByRole("row", { name: new RegExp(text) });

// quickstart.md scenario 5 (spec US3): find a bill, open it, cancel it, see stock come back.
test("bills: find by number, customer and date, open, cancel with a reason, stock restored", async () => {
  const { app, page, dataDir } = await launch();
  try {
    await page.evaluate(async () => {
      const created = await window.shopos["items.create"]({
        name: "Pipe",
        unit: "pcs",
        pricePaise: 10_000,
        openingQtyMilli: 10_000,
      });
      if (!created.ok) throw new Error(created.message);
    });
    await saveBill(page, "Ravi", 2000);
    await saveBill(page, "Meena", 1000);
    const thirdNumber = await saveBill(page, "Ravi Traders", 1000);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

    await page.getByRole("button", { name: "Bills", exact: true }).click();
    await expect(page.getByText("3 bills")).toBeVisible();

    // search by number, by customer and by date range
    await page.getByRole("textbox", { name: "Bill number" }).fill("000002");
    await expect(page.getByText("1 bill", { exact: true })).toBeVisible();
    await expect(rowFor(page, "Meena")).toBeVisible();
    await page.getByRole("textbox", { name: "Bill number" }).fill("");
    await page.getByRole("textbox", { name: "Customer name" }).fill("ravi");
    await expect(page.getByText("2 bills")).toBeVisible();
    await page.getByRole("textbox", { name: "Customer name" }).fill("");
    await page.getByLabel("From date").fill("2999-01-01");
    await expect(page.getByText("No bills match.")).toBeVisible();
    await page.getByLabel("From date").fill(today);
    await page.getByLabel("To date").fill(today);
    await expect(page.getByText("3 bills")).toBeVisible();

    // open the first bill (number 000001, 2 pcs) and cancel it with a reason
    await page.getByRole("button", { name: /000001$/ }).click();
    await expect(page.getByRole("heading", { name: /Bill: .*000001/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /edit|delete/i })).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel bill" }).click();
    await expect(
      page.getByRole("alertdialog").getByRole("button", { name: "Cancel bill" }),
    ).toBeDisabled();
    await page.getByRole("textbox", { name: "Reason (required)" }).fill("Customer changed mind");
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel bill" }).click();
    await expect(page.getByText(/Reason: Customer changed mind\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel bill" })).toHaveCount(0);

    // back in the list the bill stays, says Cancelled, and the other two stay Posted
    await page.getByRole("button", { name: "Back to bills" }).click();
    await expect(rowFor(page, "000001")).toContainText("Cancelled");
    await expect(rowFor(page, "000002")).toContainText("Posted");
    await expect(page.getByText("3 bills")).toBeVisible();

    // the number is not reused: the next bill is 000004
    expect(await saveBill(page, "Next", 1000)).toMatch(/000004$/);
    expect(thirdNumber).toMatch(/000003$/);

    await forceQuit(app);
    const queryDatabase = (sql: string) =>
      execFileSync("sqlite3", ["-cmd", ".timeout 5000", path.join(dataDir, "shopos.sqlite"), sql])
        .toString()
        .trim();
    // 10 pcs, sold 2 + 1 + 1 + 1, 2 put back by the cancel: 10 - 5 + 2 = 7 pcs
    expect(queryDatabase("select stock_milli from item_variant where display_name='Pipe'")).toBe(
      "7000",
    );
    expect(
      queryDatabase(
        "select movement_type, qty_base_milli from stock_movement where movement_type='sale_cancel'",
      ),
    ).toMatch(/^sale_cancel\|.*2000$/);
    expect(
      queryDatabase("select status, cancel_reason from bill where bill_no like '%000001'"),
    ).toBe("cancelled|Customer changed mind");
  } finally {
    await app.close().catch(() => {});
  }
});
