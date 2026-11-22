import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ShopProfile } from "@shopos/core";
import { installFakeShopos } from "../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../tests/helpers/renderWithTheme";
import { SettingsScreen } from "../../screens/SettingsScreen";
import { ToastProvider } from "../Toast";

const SHOP_PROFILE: ShopProfile = {
  name: "Prabhat Hardware",
  address: "",
  phone: "",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "",
  receiptWidth: "80mm",
  backupFolder: "/backups",
  docTitle: "Estimate",
  roundBillTotal: true,
  timeZone: "Asia/Kolkata",
};

function renderSettings(pickedFile: string | null) {
  const fake = installFakeShopos({
    "settings.get": () => SHOP_PROFILE,
    "backup.status": () => ({ lastOkAt: null, lastError: null, folder: "/backups" }),
    "system.pickBackupFile": () => ({ path: pickedFile }),
    "backup.planRestore": () => ({
      nextBillNo: "C1/26-27/000127",
      gapRecorded: { seqFrom: 121, seqTo: 126, isEstimated: false },
    }),
    "backup.restore": () => ({
      restored: true,
      nextBillNo: "C1/26-27/000127",
      gapRecorded: { seqFrom: 121, seqTo: 126, isEstimated: false },
    }),
  });
  renderWithTheme(
    <ToastProvider>
      <SettingsScreen />
    </ToastProvider>,
  );
  return fake;
}

async function clickRestoreFromFile() {
  await userEvent.click(await screen.findByRole("button", { name: "Restore from file" }));
}

describe("Restore from file on the Settings screen (task T084, FR-013b)", () => {
  it("opens the dialog after a file is chosen, and asks for the last bill number", async () => {
    renderSettings("/backups/shopos-20261120-231500.sqlite");

    await clickRestoreFromFile();

    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(screen.getByLabelText("Last bill number you printed")).toBeTruthy();
    expect(screen.getByText(/shopos-20261120-231500\.sqlite/)).toBeTruthy();
  });

  it("shows the next bill and the lost numbers first, then restores that plan", async () => {
    const fake = renderSettings("/backups/shopos-20261120-231500.sqlite");
    await clickRestoreFromFile();

    await userEvent.type(
      await screen.findByLabelText("Last bill number you printed"),
      "C1/26-27/000126",
    );
    await userEvent.click(screen.getByRole("button", { name: "Check bill numbers" }));
    expect(
      await screen.findByText(/Bill numbers 121 to 126 will be recorded as lost in the restore\./),
    ).toBeTruthy();
    expect(fake.calls.some((call) => call.commandName === "backup.restore")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Restore and restart" }));

    expect(fake.calls.at(-1)).toEqual({
      commandName: "backup.restore",
      input: {
        filePath: "/backups/shopos-20261120-231500.sqlite",
        lastIssuedBillNo: "C1/26-27/000126",
        confirmedPreview: {
          nextBillNo: "C1/26-27/000127",
          gapRecorded: { seqFrom: 121, seqTo: 126, isEstimated: false },
        },
      },
    });
    expect(await screen.findByText(/The next bill will be C1\/26-27\/000127\./)).toBeTruthy();
  });

  it("does nothing when the owner cancels the file dialog", async () => {
    const fake = renderSettings(null);

    await clickRestoreFromFile();

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(fake.calls.some((call) => call.commandName === "backup.restore")).toBe(false);
  });

  it("does not restore when the owner cancels the dialog", async () => {
    const fake = renderSettings("/backups/shopos-20261120-231500.sqlite");
    await clickRestoreFromFile();

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(fake.calls.some((call) => call.commandName === "backup.restore")).toBe(false);
  });
});
