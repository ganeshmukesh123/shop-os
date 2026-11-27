import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Bill } from "@shopos/core";
import {
  installFakeShopos,
  type FakeCommandHandlers,
} from "../../../../../tests/helpers/fakeShopos";
import { buildBill } from "../../../../../tests/helpers/billFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { BillsScreen } from "./BillsScreen";

const SAVED_BILL = buildBill();
const CANCELLED_BILL = buildBill({
  id: "bill-2",
  number: "C1/26-27/000002",
  customerName: null,
  paymentMode: "cash",
  grandTotalPaise: 5_000,
  status: "cancelled",
  cancelReason: "Wrong item",
});

function renderBillsScreen(bills: Bill[], handlers: FakeCommandHandlers = {}) {
  const fakeShopos = installFakeShopos({
    "bills.list": () => ({ bills, total: bills.length }),
    "bills.gaps": () => ({ gaps: [] }),
    ...handlers,
  });
  renderWithTheme(<BillsScreen />);
  return fakeShopos;
}

const listInputs = (calls: { commandName: string; input: unknown }[]) =>
  calls.filter((call) => call.commandName === "bills.list").map((call) => call.input);

describe("BillsScreen list (spec US3, FR-016)", () => {
  it("lists each bill with its number, customer, payment and grand total, and counts them", async () => {
    renderBillsScreen([SAVED_BILL]);

    const row = (await screen.findByRole("rowheader", { name: "C1/26-27/000001" })).closest("tr")!;

    expect(within(row).getByText("2026-11-15 15:30")).toBeTruthy();
    expect(within(row).getByText("Ramesh")).toBeTruthy();
    expect(within(row).getByText("UPI")).toBeTruthy();
    expect(within(row).getByText("₹240.00")).toBeTruthy();
    expect(screen.getByText("1 bill")).toBeTruthy();
  });

  it("says Cancelled in words for a cancelled bill and Posted for the others (NFR-011)", async () => {
    renderBillsScreen([SAVED_BILL, CANCELLED_BILL]);

    const cancelledRow = (
      await screen.findByRole("rowheader", { name: "C1/26-27/000002" })
    ).closest("tr")!;
    const postedRow = screen.getByRole("rowheader", { name: "C1/26-27/000001" }).closest("tr")!;

    expect(within(cancelledRow).getByText("Cancelled")).toBeTruthy();
    expect(within(postedRow).getByText("Posted")).toBeTruthy();
    expect(screen.getByText("2 bills")).toBeTruthy();
  });

  it("invites the first bill when the shop has none", async () => {
    renderBillsScreen([]);

    expect(await screen.findByText(/No bills yet/)).toBeTruthy();
  });

  it("says when more bills match than are shown", async () => {
    renderBillsScreen([SAVED_BILL], { "bills.list": () => ({ bills: [SAVED_BILL], total: 250 }) });

    expect(await screen.findByText(/250 bills\. Showing the newest 100/)).toBeTruthy();
  });

  it("shows the reason in an error message when the list cannot be read", async () => {
    renderBillsScreen([], {
      "bills.list": () => {
        throw Object.assign(new Error("The database is busy"), { code: "INTERNAL" });
      },
    });

    expect((await screen.findByRole("alert")).textContent).toBe("Error The database is busy");
  });
});

describe("BillsScreen search (spec US3 scenario 5)", () => {
  it("searches by bill number, customer and date range, sending only what was typed", async () => {
    const fakeShopos = renderBillsScreen([]);
    await screen.findByText(/No bills yet/);

    await userEvent.type(screen.getByRole("textbox", { name: "Bill number" }), "000002");
    await userEvent.type(screen.getByRole("textbox", { name: "Customer name" }), "ram");
    await userEvent.type(screen.getByLabelText("From date"), "2026-11-01");
    await userEvent.type(screen.getByLabelText("To date"), "2026-11-30");

    expect(listInputs(fakeShopos.calls).at(-1)).toEqual({
      number: "000002",
      customer: "ram",
      from: "2026-11-01",
      to: "2026-11-30",
      limit: 100,
      offset: 0,
    });
  });

  it("says No bills match when a search finds nothing", async () => {
    renderBillsScreen([]);
    await screen.findByText(/No bills yet/);

    await userEvent.type(screen.getByRole("textbox", { name: "Customer name" }), "zz");

    expect(await screen.findByText("No bills match.")).toBeTruthy();
  });
});
