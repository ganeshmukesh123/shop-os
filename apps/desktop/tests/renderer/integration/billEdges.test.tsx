import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createItemDirectly, freezeShopClock, installRealShopos } from "../../helpers/realShopos";
import { checkLedgerAfterEachTest, readSignedMovements } from "../../helpers/stockLedger";
import {
  addToBill,
  choosePayment,
  findErrorAlertTexts,
  PIPE,
  readBills,
  renderShopApp,
  saveWithKeyboard,
  stockOf,
} from "./billingHarness";

const ELBOW = { name: "PVC elbow", unit: "pcs", pricePaise: 4_500, openingQtyMilli: 10_000 };
const WIRE = { name: "Wire", unit: "metre", pricePaise: 1_500, openingQtyMilli: 10_000 };
/** 31 Mar 2027 23:59 and 1 Apr 2027 00:00 in the shop's zone (IST is UTC+5:30). */
const LAST_MINUTE_OF_FY = new Date(Date.UTC(2027, 2, 31, 18, 29));
const FIRST_MINUTE_OF_NEXT_FY = new Date(Date.UTC(2027, 2, 31, 18, 30));

const readLines = (realShopos: ReturnType<typeof installRealShopos>) =>
  realShopos.fixture.testDb.sqlite
    .prepare(
      "select line_no, item_name_snapshot, qty_base_milli, amount_paise from bill_line order by line_no",
    )
    .all();
const readBillDates = (realShopos: ReturnType<typeof installRealShopos>) =>
  realShopos.fixture.testDb.sqlite
    .prepare("select bill_no, business_date from bill order by billed_at")
    .all();
const startNewBill = () =>
  userEvent.click(within(screen.getByRole("main")).getByRole("button", { name: "New bill" }));

beforeEach(() => {
  freezeShopClock();
});

afterEach(() => {
  vi.useRealTimers();
});

checkLedgerAfterEachTest();

describe("screen to database: bills with several lines and edge values (US-2)", () => {
  it("IT-BIL-10 saves 2 pipes and 3 elbows as ₹375 with lines in order, two sales and one tender", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    await createItemDirectly(realShopos, ELBOW);
    renderShopApp();
    await addToBill("pip", "PVC pipe", "2");
    await addToBill("elb", "PVC elbow", "3");
    await userEvent.type(screen.getByRole("textbox", { name: /Customer name/ }), "  Ramesh  ");

    await saveWithKeyboard();

    await screen.findByRole("heading", { name: /Bill saved/ });
    expect(readLines(realShopos)).toEqual([
      { line_no: 1, item_name_snapshot: "PVC pipe", qty_base_milli: 2_000, amount_paise: 24_000 },
      { line_no: 2, item_name_snapshot: "PVC elbow", qty_base_milli: 3_000, amount_paise: 13_500 },
    ]);
    expect(readBills(realShopos)).toMatchObject([{ subtotal_paise: 37_500, total_paise: 37_500 }]);
    expect(realShopos.countRows("bill", "customer_name = ?", "Ramesh")).toBe(1);
    expect(
      realShopos.fixture.testDb.sqlite.prepare("select mode, amount_paise from bill_tender").all(),
    ).toEqual([{ mode: "cash", amount_paise: 37_500 }]);
    expect(
      readSignedMovements(realShopos).filter((movement) => movement.movementType === "sale"),
    ).toEqual([
      { itemName: "PVC pipe", movementType: "sale", signedMilli: -2_000, note: null },
      { itemName: "PVC elbow", movementType: "sale", signedMilli: -3_000, note: null },
    ]);
  });

  it("IT-BIL-11 numbers a bill at 23:59 on 31 March in 26-27 and one at 00:00 in 27-28, by shop time", async () => {
    freezeShopClock(LAST_MINUTE_OF_FY);
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    renderShopApp();
    await addToBill("pip", "PVC pipe", "1");
    await saveWithKeyboard();
    expect(
      await screen.findByRole("heading", { name: "Bill saved: C1/26-27/000001" }),
    ).toBeTruthy();

    vi.setSystemTime(FIRST_MINUTE_OF_NEXT_FY);
    await startNewBill();
    await addToBill("pip", "PVC pipe", "1");
    await saveWithKeyboard();

    expect(
      await screen.findByRole("heading", { name: "Bill saved: C1/27-28/000001" }),
    ).toBeTruthy();
    expect(readBillDates(realShopos)).toEqual([
      { bill_no: "C1/26-27/000001", business_date: "2027-03-31" },
      { bill_no: "C1/27-28/000001", business_date: "2027-04-01" },
    ]);
  });

  it("IT-BIL-12 pressing Ctrl+S twice quickly saves one bill", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    renderShopApp();
    await addToBill("pip", "PVC pipe", "2");

    await userEvent.keyboard("{Control>}ss{/Control}");

    await screen.findByRole("heading", { name: "Bill saved: C1/26-27/000001" });
    expect(realShopos.countRows("bill")).toBe(1);
    expect(realShopos.countRows("stock_movement", "movement_type = 'sale'")).toBe(1);
  });

  it("IT-BIL-13a sells 2.5 metres of wire at ₹15 as ₹37.50 and 2500 thousandths", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, WIRE);
    renderShopApp();
    await addToBill("wir", "Wire", "2.5");

    await saveWithKeyboard();

    await screen.findByRole("heading", { name: /Bill saved/ });
    expect(readLines(realShopos)).toMatchObject([{ qty_base_milli: 2_500, amount_paise: 3_750 }]);
    expect(await stockOf(realShopos, "Wire")).toBe(7_500);
  });

  it("IT-BIL-13b refuses 1.5 pipes, says why, and writes no rows", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    renderShopApp();
    await addToBill("pip", "PVC pipe", "1.5");

    await saveWithKeyboard();

    const errorTexts = await findErrorAlertTexts();
    expect(errorTexts.some((errorText) => errorText.includes("whole numbers only"))).toBe(true);
    expect(realShopos.countRows("bill")).toBe(0);
    expect(await stockOf(realShopos, "PVC pipe")).toBe(10_000);
  });

  it("IT-BIL-14a refuses a bill discount above the total and writes no rows", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    renderShopApp();
    await addToBill("pip", "PVC pipe", "2");
    await userEvent.type(screen.getByRole("textbox", { name: "Bill discount" }), "250");

    await saveWithKeyboard();

    expect(await findErrorAlertTexts()).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: /Save bill/ })).toHaveProperty("disabled", true);
    expect(realShopos.countRows("bill")).toBe(0);
  });

  it("IT-BIL-14b a bill discount equal to the total saves a ₹0.00 bill and still moves the stock", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    renderShopApp();
    await addToBill("pip", "PVC pipe", "2");
    await userEvent.type(screen.getByRole("textbox", { name: "Bill discount" }), "240");
    expect(screen.getByText("Grand total: ₹0.00")).toBeTruthy();

    await saveWithKeyboard();

    await screen.findByRole("heading", { name: /Bill saved/ });
    expect(readBills(realShopos)).toMatchObject([{ bill_discount_paise: 24_000, total_paise: 0 }]);
    expect(await stockOf(realShopos, "PVC pipe")).toBe(8_000);
  });

  it("IT-BIL-15 records an Unpaid bill as an unpaid tender for the full amount", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    renderShopApp();
    await addToBill("pip", "PVC pipe", "2");
    await choosePayment("Unpaid");

    await saveWithKeyboard();

    await screen.findByRole("heading", { name: /Bill saved/ });
    expect(
      realShopos.fixture.testDb.sqlite.prepare("select mode, amount_paise from bill_tender").all(),
    ).toEqual([{ mode: "unpaid", amount_paise: 24_000 }]);
  });
});
