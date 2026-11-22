import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ShopProfile } from "@shopos/core";
import { installFakeShopos } from "../../../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { SettingsScreen } from "../../SettingsScreen";
import { ToastProvider } from "../../../../../shared/components/Toast";

const SHOP_PROFILE: ShopProfile = {
  name: "Prabhat Hardware",
  address: "Main road",
  phone: "9800000000",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "",
  receiptWidth: "80mm",
  backupFolder: "",
  docTitle: "Estimate",
  roundBillTotal: true,
  timeZone: "Asia/Kolkata",
};

function renderSettings() {
  const fake = installFakeShopos({
    "settings.get": () => SHOP_PROFILE,
    "settings.update": (profile) => profile,
    "backup.status": () => ({ lastOkAt: null, lastError: null, folder: "" }),
  });
  renderWithTheme(
    <ToastProvider>
      <SettingsScreen />
    </ToastProvider>,
  );
  return fake;
}

const savedProfile = (calls: { commandName: string; input: unknown }[]) =>
  calls.find((call) => call.commandName === "settings.update")?.input as ShopProfile;

describe("the Settings screen's bill settings (task T080)", () => {
  it("shows the title, rounding, time zone and paper the shop has", async () => {
    renderSettings();

    expect(
      ((await screen.findByLabelText("Title printed on the bill")) as HTMLInputElement).value,
    ).toBe("Estimate");
    expect((screen.getByLabelText("Shop time zone") as HTMLInputElement).value).toBe(
      "Asia/Kolkata",
    );
    expect(
      screen.getByRole("switch", { name: "Round the bill total to the nearest rupee" }),
    ).toBeTruthy();
    expect(screen.getByRole("radio", { name: "A4 sheet" })).toBeTruthy();
  });

  it("saves a new title, rounding off and an A5 sheet, and keeps the other fields", async () => {
    const fake = renderSettings();
    const titleField = await screen.findByLabelText("Title printed on the bill");

    await userEvent.clear(titleField);
    await userEvent.type(titleField, "Cash Memo");
    await userEvent.click(
      screen.getByRole("switch", { name: "Round the bill total to the nearest rupee" }),
    );
    await userEvent.click(screen.getByRole("radio", { name: "A5 sheet" }));
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(savedProfile(fake.calls)).toEqual({
      ...SHOP_PROFILE,
      docTitle: "Cash Memo",
      roundBillTotal: false,
      receiptWidth: "a5",
    });
  });

  it("does not let an unknown time zone be saved, and the number preview keeps working", async () => {
    const fake = renderSettings();
    const zoneField = await screen.findByLabelText("Shop time zone");

    await userEvent.clear(zoneField);
    await userEvent.type(zoneField, "Mars/Olympus");

    expect(
      (screen.getByRole("button", { name: "Save settings" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText(/Next bill number will look like/)).toBeTruthy();
    expect(fake.calls.some((call) => call.commandName === "settings.update")).toBe(false);
  });

  it("does not let a blank document title be saved", async () => {
    renderSettings();
    const titleField = await screen.findByLabelText("Title printed on the bill");

    await userEvent.clear(titleField);

    expect(
      (screen.getByRole("button", { name: "Save settings" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
