import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { buildBill, buildBillLine } from "../../../../../tests/helpers/billFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { BillsScreen } from "./BillsScreen";

const SAVED_BILL = buildBill();
const CANCELLED_BILL = buildBill({
  status: "cancelled",
  cancelReason: "Wrong item",
  cancelledAt: "2026-11-15T10:00:00.000Z",
});

function renderOpenedBill(bill = SAVED_BILL) {
  installFakeShopos({
    "bills.list": () => ({ bills: [bill], total: 1 }),
    "bills.gaps": () => ({ gaps: [] }),
    "bills.get": () => ({ bill, lines: [buildBillLine()] }),
    "bills.cancel": () => ({ bill: CANCELLED_BILL }),
  });
  renderWithTheme(
    <ToastProvider>
      <BillsScreen />
    </ToastProvider>,
  );
}

const openBill = async () =>
  userEvent.click(await screen.findByRole("button", { name: "C1/26-27/000001" }));

describe("Bills screen: cancelling an opened bill (spec US3 scenario 5)", () => {
  it("cancels with a reason and then shows the CANCELLED banner with the reason", async () => {
    renderOpenedBill();
    await openBill();

    await userEvent.click(await screen.findByRole("button", { name: "Cancel bill" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Reason (required)" }), "Wrong item");
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel bill" }),
    );

    expect(await screen.findByText(/This bill was cancelled\. Reason: Wrong item\./)).toBeTruthy();
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("offers no cancel on a bill that is already cancelled, and keeps its number and lines", async () => {
    renderOpenedBill(CANCELLED_BILL);
    await openBill();

    expect(await screen.findByText(/This bill was cancelled/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel bill" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Bill: C1/26-27/000001" })).toBeTruthy();
    expect(screen.getByText("Pipe 20mm")).toBeTruthy();
  });

  it("shows no edit or delete control on a saved bill (constitution I)", async () => {
    renderOpenedBill();
    await openBill();

    await screen.findByRole("button", { name: "Print" });

    expect(screen.queryByRole("button", { name: /edit|delete|remove/i })).toBeNull();
  });
});
