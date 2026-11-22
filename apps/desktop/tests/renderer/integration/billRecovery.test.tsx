import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createItemDirectly, freezeShopClock, installRealShopos } from "../../helpers/realShopos";
import {
  addToBill,
  findErrorAlert,
  PIPE,
  renderShopApp,
  saveWithKeyboard,
  stockOf,
} from "./billingHarness";

/** A test-only trigger that makes the sale movement insert fail, halfway through the save. */
const FAIL_SALE_MOVEMENT = `
  create temp trigger fail_sale_movement before insert on stock_movement
  when new.movement_type = 'sale'
  begin select raise(abort, 'disk I/O error'); end`;

beforeEach(() => {
  freezeShopClock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("screen to database: failures and recovery (one transaction, EC power cut)", () => {
  it("IT-BIL-08 a save that fails halfway leaves no bill, line, tender or movement, nor a used number", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    const { sqlite } = realShopos.fixture.testDb;
    sqlite.exec(FAIL_SALE_MOVEMENT);
    renderShopApp();
    await addToBill("pip", "PVC pipe", "2");

    await saveWithKeyboard();

    expect(await findErrorAlert()).toBeTruthy();
    expect(realShopos.countRows("bill")).toBe(0);
    expect(realShopos.countRows("bill_line")).toBe(0);
    expect(realShopos.countRows("bill_tender")).toBe(0);
    expect(realShopos.countRows("stock_movement", "movement_type = 'sale'")).toBe(0);
    expect(await stockOf(realShopos, "PVC pipe")).toBe(10_000);
    expect(screen.getByRole("textbox", { name: "Qty PVC pipe" })).toHaveProperty("value", "2");

    sqlite.exec("drop trigger fail_sale_movement");
    await saveWithKeyboard();

    expect(
      await screen.findByRole("heading", { name: "Bill saved: C1/26-27/000001" }),
    ).toBeTruthy();
  });

  it("IT-BIL-09 recovers the unsaved bill after the app closes, and the save clears the draft", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    const firstRun = renderShopApp();
    await addToBill("pip", "PVC pipe", "2");
    await waitFor(() => expect(realShopos.countRows("draft_bill")).toBe(1));

    firstRun.unmount();
    renderShopApp();

    const offer = await screen.findByRole("dialog", { name: "Unsaved bill found" });
    expect(offer.textContent).toContain("1 line: PVC pipe");
    await userEvent.click(screen.getByRole("button", { name: "Continue bill" }));
    expect(screen.getByRole("textbox", { name: "Qty PVC pipe" })).toHaveProperty("value", "2");
    await saveWithKeyboard();

    await screen.findByRole("heading", { name: "Bill saved: C1/26-27/000001" });
    expect(realShopos.countRows("draft_bill")).toBe(0);
    expect(await stockOf(realShopos, "PVC pipe")).toBe(8_000);
  });

  it("IT-BIL-09b discarding the unsaved bill starts empty and is not offered again", async () => {
    const realShopos = installRealShopos();
    await createItemDirectly(realShopos, PIPE);
    const firstRun = renderShopApp();
    await addToBill("pip", "PVC pipe", "2");
    await waitFor(() => expect(realShopos.countRows("draft_bill")).toBe(1));

    firstRun.unmount();
    const secondRun = renderShopApp();
    await screen.findByRole("dialog", { name: "Unsaved bill found" });
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByText("Search for an item above to start the bill.")).toBeTruthy();
    await waitFor(() => expect(realShopos.countRows("draft_bill", "payload = 'null'")).toBe(1));

    secondRun.unmount();
    renderShopApp();

    expect(await screen.findByText("Search for an item above to start the bill.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
