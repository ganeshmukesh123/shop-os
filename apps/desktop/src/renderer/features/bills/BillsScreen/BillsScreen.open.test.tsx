import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  installFakeShopos,
  type FakeCommandHandlers,
} from "../../../../../tests/helpers/fakeShopos";
import { buildBill, buildBillLine } from "../../../../../tests/helpers/billFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { BillsScreen } from "./BillsScreen";

const SAVED_BILL = buildBill();

function renderBillsScreen(handlers: FakeCommandHandlers = {}) {
  const fakeShopos = installFakeShopos({
    "bills.list": () => ({ bills: [SAVED_BILL], total: 1 }),
    "bills.gaps": () => ({ gaps: [] }),
    "bills.get": () => ({ bill: SAVED_BILL, lines: [buildBillLine()] }),
    ...handlers,
  });
  renderWithTheme(
    <ToastProvider>
      <BillsScreen />
    </ToastProvider>,
  );
  return fakeShopos;
}

const countCalls = (calls: { commandName: string }[], commandName: string) =>
  calls.filter((call) => call.commandName === commandName).length;

const openSavedBill = async () =>
  userEvent.click(await screen.findByRole("button", { name: "C1/26-27/000001" }));

describe("BillsScreen opening a bill (spec US3 scenario 5)", () => {
  it("opens the chosen bill in the bill view with its lines and the print actions", async () => {
    const fakeShopos = renderBillsScreen();

    await openSavedBill();

    expect(await screen.findByRole("heading", { name: "Bill: C1/26-27/000001" })).toBeTruthy();
    expect(screen.getByText("Pipe 20mm")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Print" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save PDF" })).toBeTruthy();
    expect(fakeShopos.calls.find((call) => call.commandName === "bills.get")?.input).toEqual({
      id: "bill-1",
    });
  });

  it("offers a way back to the list and no New bill button", async () => {
    renderBillsScreen();

    await openSavedBill();

    expect(await screen.findByRole("button", { name: "Back to bills" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New bill" })).toBeNull();
  });

  it("goes back to the list with the search kept, and reads the list again", async () => {
    const fakeShopos = renderBillsScreen();
    await userEvent.type(await screen.findByRole("textbox", { name: "Customer name" }), "ram");
    await openSavedBill();
    const listReadsBefore = countCalls(fakeShopos.calls, "bills.list");

    await userEvent.click(await screen.findByRole("button", { name: "Back to bills" }));

    expect(
      ((await screen.findByRole("textbox", { name: "Customer name" })) as HTMLInputElement).value,
    ).toBe("ram");
    expect(countCalls(fakeShopos.calls, "bills.list")).toBeGreaterThan(listReadsBefore);
  });

  it("shows why a bill cannot be opened and still lets the owner go back", async () => {
    renderBillsScreen({
      "bills.get": () => {
        throw Object.assign(new Error("Bill not found"), { code: "NOT_FOUND" });
      },
    });

    await openSavedBill();

    expect((await screen.findByRole("alert")).textContent).toBe("Error Bill not found");
    expect(screen.getByRole("button", { name: "Back to bills" })).toBeTruthy();
  });
});
