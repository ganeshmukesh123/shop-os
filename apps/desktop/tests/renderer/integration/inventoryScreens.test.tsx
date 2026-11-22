import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { freezeShopClock, installRealShopos } from "../../helpers/realShopos";
import { renderShopApp, stockOf } from "./billingHarness";
import {
  addItemOnScreen,
  adjustStockOnScreen,
  itemRow,
  openScreen,
  readMovements,
} from "./inventoryHarness";

async function startWithPipe() {
  const realShopos = installRealShopos();
  renderShopApp();
  await openScreen("Items");
  await addItemOnScreen({ name: "PVC pipe", price: "120", opening: "10" });
  await itemRow("PVC pipe");
  return realShopos;
}

const isDialogClosed = () => expect(screen.queryByRole("dialog")).toBeNull();

beforeEach(() => {
  freezeShopClock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("screen to database: entering items (US-1)", () => {
  it("IT-INV-01 adds PVC pipe at ₹120 with 10 opening: one item and one opening movement", async () => {
    const realShopos = await startWithPipe();

    const row = await itemRow("PVC pipe");

    expect(within(row).getByText("₹120.00")).toBeTruthy();
    expect(within(row).getByText("10")).toBeTruthy();
    expect(
      realShopos.countRows(
        "item_variant",
        "display_name = 'PVC pipe' and selling_price_paise = 12000",
      ),
    ).toBe(1);
    expect(readMovements(realShopos)).toEqual([
      { movement_type: "opening", qty_base_milli: 10_000, note: null },
    ]);
  });

  it("IT-INV-02 refuses a second item with the same name and lists the one that exists", async () => {
    const realShopos = await startWithPipe();

    await addItemOnScreen({ name: "PVC pipe", price: "130" });

    expect(
      (await screen.findByText(/An item with this name already exists/)).textContent,
    ).toContain("PVC pipe (10 pcs in stock)");
    expect(realShopos.countRows("item_variant")).toBe(1);
    expect(readMovements(realShopos)).toHaveLength(1);
  });

  it("IT-INV-06 keeps 2.5 metres of wire as 2500 thousandths", async () => {
    const realShopos = installRealShopos();
    renderShopApp();
    await openScreen("Items");

    await addItemOnScreen({ name: "Wire", unit: "metre", price: "15", opening: "2.5" });

    expect(within(await itemRow("Wire")).getByText("2.5")).toBeTruthy();
    expect(
      realShopos.countRows("item_variant", "display_name = 'Wire' and allow_decimal = 1"),
    ).toBe(1);
    expect(await stockOf(realShopos, "Wire")).toBe(2_500);
  });
});

describe("screen to database: correcting stock (FR-006: every change is a movement with a note)", () => {
  it("IT-INV-03 removes 3 broken pipes: one adjustment of 3000 with the note, stock 7", async () => {
    const realShopos = await startWithPipe();

    await adjustStockOnScreen("PVC pipe", "Add", "-3");

    await waitFor(isDialogClosed);
    expect(within(await itemRow("PVC pipe")).getByText("7")).toBeTruthy();
    expect(readMovements(realShopos).at(-1)).toEqual({
      movement_type: "adjustment",
      qty_base_milli: 3_000,
      note: "Counted",
    });
    expect(await stockOf(realShopos, "PVC pipe")).toBe(7_000);
  });

  it("IT-INV-04 sets a counted 8: one adjustment for the difference of 2000, stock 8", async () => {
    const realShopos = await startWithPipe();

    await adjustStockOnScreen("PVC pipe", "Set", "8");

    await waitFor(isDialogClosed);
    expect(within(await itemRow("PVC pipe")).getByText("8")).toBeTruthy();
    expect(readMovements(realShopos).at(-1)).toMatchObject({
      movement_type: "adjustment",
      qty_base_milli: 2_000,
    });
    expect(await stockOf(realShopos, "PVC pipe")).toBe(8_000);
  });

  it("IT-INV-05 setting stock to what it already is writes no movement", async () => {
    const realShopos = await startWithPipe();

    await adjustStockOnScreen("PVC pipe", "Set", "10");

    await waitFor(isDialogClosed);
    expect(readMovements(realShopos)).toHaveLength(1);
    expect(await stockOf(realShopos, "PVC pipe")).toBe(10_000);
  });

  it("IT-INV-07 deactivating hides the item until Show inactive, and writes no movement", async () => {
    const realShopos = await startWithPipe();

    await userEvent.click(
      within(await itemRow("PVC pipe")).getByRole("button", { name: "Deactivate" }),
    );

    await waitFor(() => expect(screen.queryByRole("rowheader", { name: "PVC pipe" })).toBeNull());
    expect(realShopos.countRows("item_variant", "is_active = 0")).toBe(1);
    await userEvent.click(screen.getByRole("checkbox", { name: "Show inactive" }));
    expect(within(await itemRow("PVC pipe")).getByText("Inactive")).toBeTruthy();
    expect(readMovements(realShopos)).toHaveLength(1);
  });
});
