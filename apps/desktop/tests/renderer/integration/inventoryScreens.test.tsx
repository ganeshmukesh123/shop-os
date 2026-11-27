import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { saveOneBill } from "../../helpers/handlersFixture";
import { createItemDirectly, freezeShopClock, installRealShopos } from "../../helpers/realShopos";
import { checkLedgerAfterEachTest, readSignedMovements } from "../../helpers/stockLedger";
import { PIPE, renderShopApp, stockOf } from "./billingHarness";
import { addItemOnScreen, adjustStockOnScreen, itemRow, openScreen } from "./inventoryHarness";

async function startWithPipe() {
  const realShopos = installRealShopos();
  renderShopApp();
  await openScreen("Items");
  await addItemOnScreen({ name: "PVC pipe", price: "120", opening: "10" });
  await itemRow("PVC pipe");
  return realShopos;
}

const isDialogClosed = () => expect(screen.queryByRole("dialog")).toBeNull();
const OPENING_10 = {
  itemName: "PVC pipe",
  movementType: "opening",
  signedMilli: 10_000,
  note: null,
};

beforeEach(() => {
  freezeShopClock();
});

afterEach(() => {
  vi.useRealTimers();
});

checkLedgerAfterEachTest();

describe("screen to database: entering items (US-1)", () => {
  it("IT-INV-01 adds PVC pipe at ₹120 with 10 opening: one item and one opening movement", async () => {
    const realShopos = await startWithPipe();

    const row = await itemRow("PVC pipe");

    expect(within(row).getByText("₹120.00")).toBeTruthy();
    expect(within(row).getByText("10")).toBeTruthy();
    expect(
      realShopos.countRows(
        "item_variant",
        "display_name = ? and selling_price_paise = ?",
        "PVC pipe",
        12_000,
      ),
    ).toBe(1);
    expect(readSignedMovements(realShopos)).toEqual([OPENING_10]);
  });

  it("IT-INV-02 refuses a second item with the same name and lists the one that exists", async () => {
    const realShopos = await startWithPipe();

    await addItemOnScreen({ name: "PVC pipe", price: "130" });

    expect(
      (await screen.findByText(/An item with this name already exists/)).textContent,
    ).toContain("PVC pipe (10 pcs in stock)");
    expect(realShopos.countRows("item_variant")).toBe(1);
    expect(readSignedMovements(realShopos)).toEqual([OPENING_10]);
  });

  it("IT-INV-08 refuses the same name in other letter case", async () => {
    const realShopos = await startWithPipe();

    await addItemOnScreen({ name: "pvc PIPE", price: "130" });

    expect(await screen.findByText(/An item with this name already exists/)).toBeTruthy();
    expect(realShopos.countRows("item_variant")).toBe(1);
  });

  it("IT-INV-06 keeps 2.5 metres of wire as 2500 thousandths", async () => {
    const realShopos = installRealShopos();
    renderShopApp();
    await openScreen("Items");

    await addItemOnScreen({ name: "Wire", unit: "metre", price: "15", opening: "2.5" });

    expect(within(await itemRow("Wire")).getByText("2.5")).toBeTruthy();
    expect(
      realShopos.countRows("item_variant", "display_name = ? and allow_decimal = 1", "Wire"),
    ).toBe(1);
    expect(await stockOf(realShopos, "Wire")).toBe(2_500);
  });

  it("IT-INV-09 a price edit on screen writes no movement and leaves saved bills at ₹120", async () => {
    const realShopos = installRealShopos();
    const billId = await saveOneBill(realShopos.fixture, "PVC pipe");
    const stockBeforeMilli = await stockOf(realShopos, "PVC pipe");
    renderShopApp();
    await openScreen("Items");

    await userEvent.click(within(await itemRow("PVC pipe")).getByRole("button", { name: "Edit" }));
    const priceField = screen.getByRole("textbox", { name: /Selling price/ });
    await userEvent.clear(priceField);
    await userEvent.type(priceField, "135");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await within(await itemRow("PVC pipe")).findByText("₹135.00")).toBeTruthy();
    await waitFor(() =>
      expect(realShopos.countRows("item_variant", "selling_price_paise = ?", 13_500)).toBe(1),
    );
    expect(readSignedMovements(realShopos).map((movement) => movement.movementType)).toEqual([
      "opening",
      "sale",
    ]);
    expect(await stockOf(realShopos, "PVC pipe")).toBe(stockBeforeMilli);
    const savedBill = await realShopos.fixture.handlers["bills.get"]({ id: billId });
    expect(savedBill).toMatchObject({ ok: true, data: { lines: [{ ratePaise: 12_000 }] } });
  });
});

describe("screen to database: correcting stock (FR-006: every change is a movement with a note)", () => {
  it("IT-INV-03 removes 3 broken pipes: a stock-out adjustment of 3000 with the note, stock 7", async () => {
    const realShopos = await startWithPipe();

    await adjustStockOnScreen("PVC pipe", "Add", "-3");

    await waitFor(isDialogClosed);
    expect(within(await itemRow("PVC pipe")).getByText("7")).toBeTruthy();
    expect(readSignedMovements(realShopos).at(-1)).toEqual({
      itemName: "PVC pipe",
      movementType: "adjustment",
      signedMilli: -3_000,
      note: "Counted",
    });
    expect(await stockOf(realShopos, "PVC pipe")).toBe(7_000);
  });

  it("IT-INV-04 sets a counted 8: a stock-out adjustment of 2000, stock 8", async () => {
    const realShopos = await startWithPipe();

    await adjustStockOnScreen("PVC pipe", "Set", "8");

    await waitFor(isDialogClosed);
    expect(within(await itemRow("PVC pipe")).getByText("8")).toBeTruthy();
    expect(readSignedMovements(realShopos).at(-1)).toMatchObject({
      movementType: "adjustment",
      signedMilli: -2_000,
    });
    expect(await stockOf(realShopos, "PVC pipe")).toBe(8_000);
  });

  it("IT-INV-05 setting stock to what it already is writes no movement", async () => {
    const realShopos = await startWithPipe();

    await adjustStockOnScreen("PVC pipe", "Set", "10");

    await waitFor(isDialogClosed);
    expect(readSignedMovements(realShopos)).toEqual([OPENING_10]);
  });

  it("IT-INV-10 setting a negative item to 0 writes a stock-in of 2000 and clears the warning", async () => {
    const realShopos = installRealShopos();
    const pipeId = await createItemDirectly(realShopos, { ...PIPE, openingQtyMilli: 1_000 });
    await realShopos.fixture.handlers["stock.adjust"]({
      itemId: pipeId,
      mode: "add",
      quantityMilli: -3_000,
      note: "Sold off the books",
    });
    renderShopApp();
    await openScreen("Items");
    expect(
      within(await itemRow("PVC pipe")).getByText("Negative stock: needs correction"),
    ).toBeTruthy();

    await adjustStockOnScreen("PVC pipe", "Set", "0");

    await waitFor(isDialogClosed);
    expect(readSignedMovements(realShopos).at(-1)).toMatchObject({ signedMilli: 2_000 });
    await waitFor(() => expect(screen.queryByText("Negative stock: needs correction")).toBeNull());
    expect(await stockOf(realShopos, "PVC pipe")).toBe(0);
  });

  it("IT-INV-11 refuses 2.5 for an item counted in whole pieces, and writes nothing", async () => {
    const realShopos = await startWithPipe();

    await adjustStockOnScreen("PVC pipe", "Set", "2.5");

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/^Error$/)).toBeTruthy();
    expect(readSignedMovements(realShopos)).toEqual([OPENING_10]);
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
    expect(readSignedMovements(realShopos)).toEqual([OPENING_10]);
  });
});
