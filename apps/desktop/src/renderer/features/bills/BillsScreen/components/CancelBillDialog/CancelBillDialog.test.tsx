import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeShopos } from "../../../../../../../tests/helpers/fakeShopos";
import { buildBill } from "../../../../../../../tests/helpers/billFixtures";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { CancelBillDialog } from "./CancelBillDialog";

const CANCELLED_BILL = buildBill({
  status: "cancelled",
  cancelReason: "Wrong item",
  cancelledAt: "2026-11-15T10:00:00.000Z",
});

function renderDialog(cancelHandler = () => ({ bill: CANCELLED_BILL })) {
  const fakeShopos = installFakeShopos({ "bills.cancel": cancelHandler });
  const onClose = vi.fn();
  const onCancelled = vi.fn();
  renderWithTheme(
    <CancelBillDialog bill={buildBill()} onClose={onClose} onCancelled={onCancelled} />,
  );
  return { fakeShopos, onClose, onCancelled };
}

const confirmButton = () =>
  screen.getByRole("button", { name: "Cancel bill" }) as HTMLButtonElement;
const reasonField = () => screen.getByRole("textbox", { name: "Reason (required)" });

describe("CancelBillDialog (spec US3, FR-017)", () => {
  it("names the bill and says what cancelling does before anything is done", () => {
    renderDialog();

    expect(screen.getByRole("alertdialog", { name: "Cancel bill C1/26-27/000001" })).toBeTruthy();
    expect(screen.getByText(/stock of every line is put back/)).toBeTruthy();
  });

  it("will not cancel until a reason is typed, and spaces alone are not a reason", async () => {
    renderDialog();
    expect(confirmButton().disabled).toBe(true);

    await userEvent.type(reasonField(), "   ");

    expect(confirmButton().disabled).toBe(true);
  });

  it("sends the trimmed reason and hands back the cancelled bill", async () => {
    const { fakeShopos, onCancelled } = renderDialog();

    await userEvent.type(reasonField(), "  Wrong item ");
    await userEvent.click(confirmButton());

    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith(CANCELLED_BILL));
    expect(fakeShopos.calls.find((call) => call.commandName === "bills.cancel")?.input).toEqual({
      id: "bill-1",
      reason: "Wrong item",
    });
  });

  it("shows why the cancel failed, keeps the reason and stays open", async () => {
    const { onCancelled } = renderDialog(() => {
      throw Object.assign(new Error("This bill is already cancelled"), {
        code: "ALREADY_CANCELLED",
      });
    });

    await userEvent.type(reasonField(), "Wrong item");
    await userEvent.click(confirmButton());

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Error This bill is already cancelled",
    );
    expect((reasonField() as HTMLInputElement).value).toBe("Wrong item");
    expect(onCancelled).not.toHaveBeenCalled();
  });

  it("closes without cancelling when the owner keeps the bill", async () => {
    const { fakeShopos, onClose } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Keep bill" }));

    expect(onClose).toHaveBeenCalled();
    expect(fakeShopos.calls).toHaveLength(0);
  });
});
