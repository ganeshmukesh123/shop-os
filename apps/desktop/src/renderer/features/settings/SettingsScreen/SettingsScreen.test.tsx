import { screen } from "@testing-library/react";
import type { ShopProfile } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { SettingsScreen } from "./SettingsScreen";

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

describe("SettingsScreen (design guidelines 5.1, PRD NFR-011)", () => {
  it("a failed backup shows the words 'Last backup failed' before the reason", async () => {
    installFakeShopos({
      "settings.get": () => SHOP_PROFILE,
      "backup.status": () => ({ lastOkAt: null, lastError: "Folder is missing", folder: "" }),
    });

    renderWithTheme(
      <ToastProvider>
        <SettingsScreen />
      </ToastProvider>,
    );

    const backupAlert = await screen.findByRole("alert");
    expect(backupAlert.textContent).toBe("Last backup failed Folder is missing");
  });

  it("a bill number format that is too long is a labelled error, not only red text", async () => {
    installFakeShopos({
      "settings.get": () => ({ ...SHOP_PROFILE, numberTemplate: "SHOP-INVOICE/{seq}" }),
      "backup.status": () => ({ lastOkAt: null, lastError: null, folder: "" }),
    });

    renderWithTheme(
      <ToastProvider>
        <SettingsScreen />
      </ToastProvider>,
    );

    const templateAlert = await screen.findByRole("alert");
    expect(templateAlert.textContent).toMatch(/^Error Number could be \d+ characters/);
  });
});
