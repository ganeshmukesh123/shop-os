import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { RestoreBackupDialog } from "./RestoreBackupDialog";
import type { IRestoreBackupDialogProps } from "./RestoreBackupDialog.types";

const PLAN_TEXT =
  "The next bill will be C1/26-27/000127. Bill numbers 121 to 126 will be recorded as lost in the restore.";

function buildProps(overrides: Partial<IRestoreBackupDialogProps> = {}): IRestoreBackupDialogProps {
  return {
    isOpen: true,
    backupFileName: "shopos-20261120-231500.sqlite",
    example: "C1/26-27/000126",
    typedNumber: "",
    planText: null,
    errorMessage: null,
    isBusy: false,
    onTypedNumberChange: vi.fn(),
    onCheck: vi.fn(),
    onRestore: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

const restoreButton = () =>
  screen.getByRole("button", { name: "Restore and restart" }) as HTMLButtonElement;

describe("RestoreBackupDialog (task T084, FR-013b, research D21)", () => {
  it("shows nothing while closed", () => {
    renderWithTheme(<RestoreBackupDialog {...buildProps({ isOpen: false })} />);

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("names the backup file and warns that everything is replaced", () => {
    renderWithTheme(<RestoreBackupDialog {...buildProps()} />);

    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Restore from backup")).toBeTruthy();
    expect(screen.getByText(/shopos-20261120-231500\.sqlite/)).toBeTruthy();
    expect(screen.getByText(/Restoring replaces ALL current data/)).toBeTruthy();
  });

  it("asks for the last printed bill number, with the shop's own example", () => {
    renderWithTheme(<RestoreBackupDialog {...buildProps()} />);

    expect(screen.getByLabelText("Last bill number you printed")).toBeTruthy();
    expect(screen.getByText(/Example: C1\/26-27\/000126\./)).toBeTruthy();
  });

  it("says what happens when the owner cannot find the number", () => {
    renderWithTheme(<RestoreBackupDialog {...buildProps()} />);

    expect(screen.getByText(/skips the next 100 bill numbers/)).toBeTruthy();
    expect(screen.getByText(/Lost in restore/)).toBeTruthy();
  });

  it("passes each change of the number to the screen", async () => {
    const props = buildProps();
    renderWithTheme(<RestoreBackupDialog {...props} />);

    await userEvent.type(screen.getByLabelText("Last bill number you printed"), "C");

    expect(props.onTypedNumberChange).toHaveBeenCalledWith("C");
  });

  it("cannot restore before the bill numbers are checked", () => {
    renderWithTheme(<RestoreBackupDialog {...buildProps()} />);

    expect(restoreButton().disabled).toBe(true);
  });

  it("checks the numbers when asked", async () => {
    const props = buildProps({ typedNumber: "C1/26-27/000126" });
    renderWithTheme(<RestoreBackupDialog {...props} />);

    await userEvent.click(screen.getByRole("button", { name: "Check bill numbers" }));

    expect(props.onCheck).toHaveBeenCalledOnce();
    expect(props.onRestore).not.toHaveBeenCalled();
  });

  it("shows the plan with a word, and only then restores", async () => {
    const props = buildProps({ planText: PLAN_TEXT });
    renderWithTheme(<RestoreBackupDialog {...props} />);

    expect(screen.getByText(PLAN_TEXT)).toBeTruthy();
    expect(screen.getByText("Check")).toBeTruthy();
    await userEvent.click(restoreButton());

    expect(props.onRestore).toHaveBeenCalledOnce();
  });

  it("cancels without restoring", async () => {
    const props = buildProps({ planText: PLAN_TEXT });
    renderWithTheme(<RestoreBackupDialog {...props} />);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(props.onRestore).not.toHaveBeenCalled();
  });

  it("shows a refused number as an error with its word, and keeps the dialog open", () => {
    renderWithTheme(
      <RestoreBackupDialog {...buildProps({ errorMessage: "That is not a bill number." })} />,
    );

    expect(screen.getByRole("alert").textContent).toBe("Error That is not a bill number.");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("cannot be pressed twice while it works", () => {
    renderWithTheme(<RestoreBackupDialog {...buildProps({ planText: PLAN_TEXT, isBusy: true })} />);

    const isDisabled = (name: RegExp | string) =>
      (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;
    expect(isDisabled(/Restoring/)).toBe(true);
    expect(isDisabled("Check bill numbers")).toBe(true);
    expect(isDisabled("Cancel")).toBe(true);
  });

  it("locks the number while a check or restore runs, so the plan always matches the field", () => {
    renderWithTheme(<RestoreBackupDialog {...buildProps({ isBusy: true })} />);

    const numberField = screen.getByLabelText("Last bill number you printed") as HTMLInputElement;
    expect(numberField.disabled).toBe(true);
  });
});
