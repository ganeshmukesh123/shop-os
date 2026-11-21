import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ShopProfile } from "@shopos/core";
import { ToastProvider } from "../../../src/renderer/shared/components/Toast";
import { SettingsScreen } from "../../../src/renderer/screens/SettingsScreen";
import { ThemeProvider } from "../../../src/renderer/shared/theme/ThemeProvider";
import { THEME_STORAGE_KEY } from "../../../src/renderer/shared/theme/theme.constants";
import { installFakeShopos } from "../../helpers/fakeShopos";

const SHOP_PROFILE: ShopProfile = {
  name: "Prabhat Hardware",
  address: "Main road",
  phone: "9800000000",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "",
  receiptWidth: "80mm",
  backupFolder: "",
};

function renderSettings() {
  installFakeShopos({
    "settings.get": () => SHOP_PROFILE,
    "backup.status": () => ({ lastOkAt: null, lastError: null, folder: "" }),
  });
  return render(
    <ThemeProvider>
      <ToastProvider>
        <SettingsScreen />
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe("Settings screen: appearance (design guidelines 3.1)", () => {
  it("offers System, Light and Dark, with System chosen by default", async () => {
    renderSettings();

    const systemChoice = await screen.findByRole("radio", { name: "System" });

    expect(systemChoice.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Light" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeTruthy();
  });

  it("switches the whole app to dark and remembers it when Dark is chosen", async () => {
    renderSettings();

    await userEvent.click(await screen.findByRole("radio", { name: "Dark" }));

    expect(document.querySelector(".radix-themes")?.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
