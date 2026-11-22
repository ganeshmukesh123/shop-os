import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BackupStatus } from "@shopos/core";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { BackupSection } from "./BackupSection";
import type { IBackupSectionProps } from "./BackupSection.types";

const NO_BACKUP_YET: BackupStatus = { lastOkAt: null, lastError: null, folder: "/backups" };

function renderSection(overrides: Partial<IBackupSectionProps> = {}) {
  const handlers = { onChooseFolder: vi.fn(), onBackUpNow: vi.fn(), onRestore: vi.fn() };
  renderWithTheme(
    <BackupSection
      backupFolder="/backups"
      status={NO_BACKUP_YET}
      isBackingUp={false}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe("BackupSection", () => {
  it("says there is no backup yet and shows the chosen folder", () => {
    renderSection();

    expect(screen.getByText("No backup yet")).toBeTruthy();
    expect((screen.getByDisplayValue("/backups") as HTMLInputElement).readOnly).toBe(true);
  });

  it("shows the reason in words when the last backup failed", () => {
    renderSection({ status: { ...NO_BACKUP_YET, lastError: "Folder is missing" } });

    expect(screen.getByRole("alert").textContent).toBe("Last backup failed Folder is missing");
  });

  it("cannot back up until a folder is chosen, but can still restore", async () => {
    const handlers = renderSection({ backupFolder: "" });

    expect(
      (screen.getByRole("button", { name: "Back up now" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Restore from file" }));

    expect(handlers.onRestore).toHaveBeenCalledTimes(1);
  });

  it("asks to choose a folder and to back up now when the buttons are pressed", async () => {
    const handlers = renderSection();

    await userEvent.click(screen.getByRole("button", { name: "Choose folder" }));
    await userEvent.click(screen.getByRole("button", { name: "Back up now" }));

    expect(handlers.onChooseFolder).toHaveBeenCalledTimes(1);
    expect(handlers.onBackUpNow).toHaveBeenCalledTimes(1);
  });
});
