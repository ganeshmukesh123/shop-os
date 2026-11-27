import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createItemDirectly, freezeShopClock, installRealShopos } from "../../helpers/realShopos";
import { checkLedgerAfterEachTest } from "../../helpers/stockLedger";
import {
  addToBill,
  PIPE,
  readBills,
  renderShopApp,
  saveWithKeyboard,
  stockOf,
} from "./billingHarness";

const navigation = () => screen.getByRole("navigation", { name: "Main" });

beforeEach(() => {
  freezeShopClock();
});

afterEach(() => {
  vi.useRealTimers();
});

checkLedgerAfterEachTest();

describe("screen to database: amounts and stock on a saved bill (US-2, FR-010a)", () => {
  it("IT-BIL-03 sells 3 when only 1 is in stock, warns, and flags the item for correction", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, { ...PIPE, openingQtyMilli: 1_000 });
    renderShopApp();
    await addToBill("pip", "PVC pipe", "3");

    await saveWithKeyboard();

    const warning = await screen.findByText(/Stock is now below zero for:/);
    expect(warning.textContent).toContain("PVC pipe (-2 pcs)");
    expect(realShopos.countRows("bill")).toBe(1);
    expect(await stockOf(realShopos, "PVC pipe")).toBe(-2_000);
    // The count beside Items is reloaded when the screen changes, so open Items to see it.
    await userEvent.click(within(navigation()).getByRole("button", { name: "Items" }));
    expect(await within(navigation()).findByText("1 Needs correction")).toBeTruthy();
    expect(await screen.findByText("Negative stock: needs correction")).toBeTruthy();
  });

  it("IT-BIL-04 takes a ₹10 line discount and a 10% bill discount: ₹240 becomes ₹207", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    renderShopApp();
    await addToBill("pip", "PVC pipe", "2");
    await userEvent.type(screen.getByRole("textbox", { name: "Discount PVC pipe" }), "10");
    await userEvent.type(screen.getByRole("textbox", { name: "Bill discount" }), "10");
    const billDiscountType = screen.getByRole("radiogroup", { name: "Bill discount type" });
    await userEvent.click(within(billDiscountType).getByRole("radio", { name: "%" }));
    expect(screen.getByText("Grand total: ₹207.00")).toBeTruthy();

    await saveWithKeyboard();

    await screen.findByRole("heading", { name: /Bill saved/ });
    expect(readBills(realShopos)).toMatchObject([
      {
        subtotal_paise: 23_000,
        bill_discount_paise: 2_300,
        round_off_paise: 0,
        total_paise: 20_700,
      },
    ]);
    expect(
      realShopos.countRows("bill_line", "line_discount_paise = 1000 and amount_paise = 23000"),
    ).toBe(1);
  });

  it("IT-BIL-05 rounds 3 × ₹33.20 = ₹99.60 up to ₹100.00 with a +₹0.40 round-off", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, { ...PIPE, name: "Hose clip", pricePaise: 3_320 });
    renderShopApp();
    await addToBill("hos", "Hose clip", "3");
    expect(await screen.findByText("Round off: +₹0.40")).toBeTruthy();
    expect(screen.getByText("Grand total: ₹100.00")).toBeTruthy();

    await saveWithKeyboard();

    await screen.findByRole("heading", { name: /Bill saved/ });
    expect(readBills(realShopos)).toMatchObject([
      { subtotal_paise: 9_960, round_off_paise: 40, total_paise: 10_000 },
    ]);
  });
});
