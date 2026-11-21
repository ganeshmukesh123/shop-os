import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithTheme } from "../../../../tests/helpers/renderWithTheme";
import { RestoreBackupDialog } from "./RestoreBackupDialog";
import type { IRestoreBackupDialogProps } from "./RestoreBackupDialog.types";

function buildProps(overrides: Partial<IRestoreBackupDialogProps> = {}): IRestoreBackupDialogProps {
  return {
    isOpen: true,
    backupFileName: "shopos-20261120-231500.sqlite",
    example: "C1/26-27/000126",
    errorMessage: null,
    isBusy: false,
    onRestore: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

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

  it("restores with the number the owner typed, without the spaces around it", async () => {
    const props = buildProps();
    renderWithTheme(<RestoreBackupDialog {...props} />);

    await userEvent.type(
      screen.getByLabelText("Last bill number you printed"),
      " C1/26-27/000126 ",
    );
    await userEvent.click(screen.getByRole("button", { name: "Restore and restart" }));

    expect(props.onRestore).toHaveBeenCalledWith("C1/26-27/000126");
  });

  it("restores with an empty number when the owner leaves it blank", async () => {
    const props = buildProps();
    renderWithTheme(<RestoreBackupDialog {...props} />);

    await userEvent.click(screen.getByRole("button", { name: "Restore and restart" }));

    expect(props.onRestore).toHaveBeenCalledWith("");
  });

  it("cancels without restoring", async () => {
    const props = buildProps();
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
    renderWithTheme(<RestoreBackupDialog {...buildProps({ isBusy: true })} />);

    expect((screen.getByRole("button", { name: /Restoring/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
