import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createItemDirectly, freezeShopClock, installRealShopos } from "../../helpers/realShopos";
import {
  addToBill,
  choosePayment,
  findErrorAlert,
  PIPE,
  readBills,
  renderShopApp,
  saveWithKeyboard,
  stockOf,
} from "./billingHarness";

beforeEach(() => {
  freezeShopClock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("screen to database: saving a bill (US-2, one transaction, then print)", () => {
  it("IT-BIL-01 saves 2 pipes at ₹120 as one bill, one line, one tender and one sale movement", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    renderShopApp();
    await addToBill("pip", "PVC pipe", "2");
    await choosePayment("UPI");

    await saveWithKeyboard();

    expect(
      await screen.findByRole("heading", { name: "Bill saved: C1/26-27/000001" }),
    ).toBeTruthy();
    expect(readBills(realShopos)).toMatchObject([
      { bill_no: "C1/26-27/000001", seq: 1, subtotal_paise: 24_000, total_paise: 24_000 },
    ]);
    const savedLine = realShopos.fixture.testDb.sqlite
      .prepare(
        "select item_name_snapshot, unit_snapshot, qty_base_milli, unit_price_paise, amount_paise from bill_line",
      )
      .all();
    expect(savedLine).toEqual([
      {
        item_name_snapshot: "PVC pipe",
        unit_snapshot: "pcs",
        qty_base_milli: 2_000,
        unit_price_paise: 12_000,
        amount_paise: 24_000,
      },
    ]);
    expect(
      realShopos.fixture.testDb.sqlite.prepare("select mode, amount_paise from bill_tender").all(),
    ).toEqual([{ mode: "upi", amount_paise: 24_000 }]);
    expect(
      realShopos.countRows("stock_movement", "movement_type = 'sale' and qty_base_milli = 2000"),
    ).toBe(1);
    expect(await stockOf(realShopos, "PVC pipe")).toBe(8_000);
  });

  it("IT-BIL-02 a retry after a lost reply keeps exactly one bill (same clientBillId)", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    renderShopApp();
    await addToBill("pip", "PVC pipe", "2");
    realShopos.loseNextReplyOf("bills.save");

    await saveWithKeyboard();
    expect((await findErrorAlert()).textContent).toBe("Error The reply to bills.save was lost");
    await saveWithKeyboard();

    expect(
      await screen.findByRole("heading", { name: "Bill saved: C1/26-27/000001" }),
    ).toBeTruthy();
    expect(realShopos.countRows("bill")).toBe(1);
    expect(realShopos.countRows("bill_line")).toBe(1);
    expect(realShopos.countRows("stock_movement", "movement_type = 'sale'")).toBe(1);
    expect(await stockOf(realShopos, "PVC pipe")).toBe(8_000);
  });

  it("IT-BIL-06 gives the next bill the next number in the same financial year", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    renderShopApp();
    await addToBill("pip", "PVC pipe", "1");
    await saveWithKeyboard();
    await screen.findByRole("heading", { name: /Bill saved/ });
    await userEvent.click(
      within(screen.getByRole("main")).getByRole("button", { name: "New bill" }),
    );

    await addToBill("pip", "PVC pipe", "1");
    await saveWithKeyboard();

    expect(
      await screen.findByRole("heading", { name: "Bill saved: C1/26-27/000002" }),
    ).toBeTruthy();
    const savedBills = readBills(realShopos);
    expect(savedBills.map((savedBill) => savedBill.seq)).toEqual([1, 2]);
    expect(savedBills.every((savedBill) => savedBill.bill_no.length <= 16)).toBe(true);
    expect(new Set(savedBills.map((savedBill) => savedBill.client_bill_id)).size).toBe(2);
  });

  it("IT-BIL-07 keeps the sold rate on the saved line after the item's price changes", async () => {
    const realShopos = installRealShopos();
    const pipeId = await createItemDirectly(realShopos, PIPE);
    renderShopApp();
    await addToBill("pip", "PVC pipe", "2");
    await saveWithKeyboard();
    await screen.findByRole("heading", { name: /Bill saved/ });

    await realShopos.fixture.handlers["items.update"]({ id: pipeId, pricePaise: 13_500 });

    const billId = (
      realShopos.fixture.testDb.sqlite.prepare("select id from bill").get() as { id: string }
    ).id;
    const fetched = await realShopos.fixture.handlers["bills.get"]({ id: billId });
    expect(fetched).toMatchObject({
      ok: true,
      data: { lines: [{ ratePaise: 12_000, amountPaise: 24_000 }] },
    });
  });
});
