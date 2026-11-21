import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BackupStatus, ShopProfile } from "@shopos/core";
import {
  installFakeShopos,
  type FakeCommandHandlers,
} from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { SettingsScreen } from "./SettingsScreen";

const PROFILE_WITH_FOLDER: ShopProfile = {
  name: "Prabhat Hardware",
  address: "",
  phone: "",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "",
  receiptWidth: "80mm",
  backupFolder: "/backups",
};

const NO_BACKUP_YET: BackupStatus = { lastOkAt: null, lastError: null, folder: "/backups" };

function renderSettings(
  handlers: FakeCommandHandlers = {},
  profile: ShopProfile = PROFILE_WITH_FOLDER,
  status: BackupStatus = NO_BACKUP_YET,
) {
  const fake = installFakeShopos({
    "settings.get": () => profile,
    "settings.update": (savedProfile) => savedProfile,
    "backup.status": () => status,
    ...handlers,
  });
  renderWithTheme(
    <ToastProvider>
      <SettingsScreen />
    </ToastProvider>,
  );
  const callsTo = (commandName: string) =>
    fake.calls.filter((fakeCall) => fakeCall.commandName === commandName);
  return { callsTo };
}

const button = (name: string) =>
  screen.findByRole("button", { name }) as Promise<HTMLButtonElement>;

describe("SettingsScreen backup: what it shows", () => {
  it("shows the backup folder, and says there is no folder chosen when there is none", async () => {
    renderSettings({}, { ...PROFILE_WITH_FOLDER, backupFolder: "" });

    const folderField = await screen.findByPlaceholderText("No folder chosen");

    expect((folderField as HTMLInputElement).value).toBe("");
    expect(((await button("Back up now")) as HTMLButtonElement).disabled).toBe(true);
  });

  it("says No backup yet until there has been a good one", async () => {
    renderSettings();

    expect(await screen.findByText("No backup yet")).toBeTruthy();
  });

  it("shows the date and time of the last good backup", async () => {
    renderSettings({}, PROFILE_WITH_FOLDER, {
      ...NO_BACKUP_YET,
      lastOkAt: "2026-11-15T09:30:00.000Z",
    });

    const lastBackup = await screen.findByText(/Last good backup/);

    expect(lastBackup.querySelector("b")!.textContent).toBe(
      new Date("2026-11-15T09:30:00.000Z").toLocaleString(),
    );
  });

  it("shows the words Last backup failed before the reason when the last backup failed", async () => {
    renderSettings({}, PROFILE_WITH_FOLDER, { ...NO_BACKUP_YET, lastError: "Folder is missing" });

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Last backup failed Folder is missing",
    );
  });
});

describe("SettingsScreen backup: choosing the folder", () => {
  it("saves the chosen folder with the other settings and says Settings saved", async () => {
    const { callsTo } = renderSettings({ "system.pickFolder": () => ({ path: "/second-drive" }) });

    await userEvent.click(await button("Choose folder"));

    expect(await screen.findByText("Settings saved")).toBeTruthy();
    expect(callsTo("settings.update")[0]!.input).toEqual({
      ...PROFILE_WITH_FOLDER,
      backupFolder: "/second-drive",
    });
  });

  it("changes nothing when the folder dialog is cancelled", async () => {
    const { callsTo } = renderSettings({ "system.pickFolder": () => ({ path: null }) });

    await userEvent.click(await button("Choose folder"));
    await screen.findByRole("button", { name: "Choose folder" });

    expect(callsTo("settings.update")).toHaveLength(0);
  });
});

describe("SettingsScreen backup: Back up now", () => {
  it("backs up, says Backup complete, and reads the status again", async () => {
    const { callsTo } = renderSettings({
      "backup.run": () => ({ path: "/backups/shopos.sqlite", finishedAt: "2026-11-15T09:30:00Z" }),
    });
    const statusReadsBefore = 1;

    await userEvent.click(await button("Back up now"));

    expect(await screen.findByText("Backup complete")).toBeTruthy();
    expect(callsTo("backup.run")).toHaveLength(1);
    await screen.findByRole("button", { name: "Back up now" });
    expect(callsTo("backup.status").length).toBeGreaterThan(statusReadsBefore);
  });

  it("shows the reason in an error toast when the backup fails, and reads the status again", async () => {
    const { callsTo } = renderSettings({
      "backup.run": () => {
        throw Object.assign(new Error("The drive is not connected"), { code: "BACKUP_FAILED" });
      },
    });

    await userEvent.click(await button("Back up now"));

    expect((await screen.findByRole("alert")).textContent).toBe("Error The drive is not connected");
    expect(callsTo("backup.status").length).toBeGreaterThan(1);
  });
});

describe("SettingsScreen backup: Restore from file", () => {
  const RESTORE_HANDLERS: FakeCommandHandlers = {
    "system.pickBackupFile": () => ({ path: "/backups/shopos-20261115.sqlite" }),
    "backup.restore": () => ({ restored: true }),
  };

  afterEach(() => vi.restoreAllMocks());

  it("asks first, then restores the chosen file and says the app will restart", async () => {
    const askUser = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { callsTo } = renderSettings(RESTORE_HANDLERS);

    await userEvent.click(await button("Restore from file"));

    expect(await screen.findByText("Restoring… the app will restart.")).toBeTruthy();
    expect(askUser).toHaveBeenCalledWith(expect.stringContaining("replaces ALL current data"));
    expect(callsTo("backup.restore")[0]!.input).toEqual({
      filePath: "/backups/shopos-20261115.sqlite",
    });
  });

  it("restores nothing when the owner says no", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { callsTo } = renderSettings(RESTORE_HANDLERS);

    await userEvent.click(await button("Restore from file"));
    await screen.findByRole("button", { name: "Restore from file" });

    expect(callsTo("backup.restore")).toHaveLength(0);
  });

  it("does not even ask when no file was chosen", async () => {
    const askUser = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderSettings({ "system.pickBackupFile": () => ({ path: null }) });

    await userEvent.click(await button("Restore from file"));
    await screen.findByRole("button", { name: "Restore from file" });

    expect(askUser).not.toHaveBeenCalled();
  });

  it("shows why when the file is not a valid backup, and keeps the app as it was", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderSettings({
      ...RESTORE_HANDLERS,
      "backup.restore": () => {
        throw Object.assign(new Error("This is not a valid Shop OS backup"), {
          code: "INVALID_BACKUP",
        });
      },
    });

    await userEvent.click(await button("Restore from file"));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Error This is not a valid Shop OS backup",
    );
  });
});
