import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BackupStatus, ShopProfile } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { SettingsScreen } from "./SettingsScreen";

const SHOP_PROFILE: ShopProfile = {
  name: "Prabhat Hardware",
  address: "Main road",
  phone: "9800000000",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "Thank you",
  receiptWidth: "80mm",
  backupFolder: "/backups",
  docTitle: "Estimate",
  roundBillTotal: true,
  timeZone: "Asia/Kolkata",
};

const NO_BACKUP_YET: BackupStatus = { lastOkAt: null, lastError: null, folder: "/backups" };

function renderSettings(profile: ShopProfile = SHOP_PROFILE) {
  const fake = installFakeShopos({
    "settings.get": () => profile,
    "settings.update": (savedProfile) => savedProfile,
    "backup.status": () => NO_BACKUP_YET,
  });
  renderWithTheme(
    <ToastProvider>
      <SettingsScreen />
    </ToastProvider>,
  );
  return fake;
}

const profileField = (labelText: string | RegExp) =>
  screen.findByRole("textbox", { name: labelText });
const saveButton = () => screen.getByRole("button", { name: "Save settings" }) as HTMLButtonElement;

/** Replaces what is in a field: clear, then type (a field with `{` needs it doubled for the typist). */
async function replaceText(labelText: string | RegExp, newText: string) {
  const textField = await profileField(labelText);
  await userEvent.clear(textField);
  await userEvent.type(textField, newText.replace(/[{[]/g, "$&$&"));
}

describe("SettingsScreen: the shop details", () => {
  it("shows the heading and every shop detail the bill prints", async () => {
    renderSettings();

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();
    const values = await Promise.all(
      [
        "Shop name",
        "Address",
        "Phone",
        "Bill series code",
        /^Bill number format/,
        "Bill footer text",
      ].map(async (labelText) => ((await profileField(labelText)) as HTMLInputElement).value),
    );
    expect(values).toEqual([
      "Prabhat Hardware",
      "Main road",
      "9800000000",
      "C1",
      "{series}/{fy}/{seq}",
      "Thank you",
    ]);
    expect(
      (screen.getByRole("radio", { name: "80 mm" }) as HTMLButtonElement).getAttribute(
        "aria-checked",
      ),
    ).toBe("true");
  });

  it("says Loading until the shop details have arrived", () => {
    renderSettings();

    expect(screen.getByText("Loading…")).toBeTruthy();
  });
});

describe("SettingsScreen: the bill number preview and its warning", () => {
  it("shows how the next bill number will look, using the series code", async () => {
    renderSettings();

    const preview = await screen.findByText(/Next bill number will look like/);

    expect(preview.querySelector("b")!.textContent).toMatch(/^C1\/\d{2}-\d{2}\/000001$/);
  });

  it("updates the preview as the series code is typed (a short code, so the number still fits in 16 characters)", async () => {
    renderSettings();
    await replaceText("Bill series code", "B2");

    const preview = await screen.findByText(/Next bill number will look like/);

    expect(preview.querySelector("b")!.textContent).toMatch(/^B2\/\d{2}-\d{2}\/000001$/);
  });

  it("warns with the word Error and the length when a number could pass 16 characters, and blocks Save", async () => {
    renderSettings();
    await replaceText(/^Bill number format/, "SHOP-INVOICE/{seq}");

    const warning = await screen.findByRole("alert");

    expect(warning.textContent).toMatch(/^Error Number could be \d+ characters; the limit is 16$/);
    expect(screen.queryByText(/Next bill number will look like/)).toBeNull();
    expect(saveButton().disabled).toBe(true);
  });

  it("warns when the format has no {seq}, and blocks Save", async () => {
    renderSettings();
    await replaceText(/^Bill number format/, "{series}/{fy}");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Error Template must contain {seq}",
    );
    expect(saveButton().disabled).toBe(true);
  });
});

describe("SettingsScreen: saving the shop details", () => {
  it("sends the edited details and says Settings saved", async () => {
    const fake = renderSettings();
    await replaceText("Shop name", "Prabhat Paints");
    await userEvent.click(await screen.findByRole("radio", { name: "58 mm" }));

    await userEvent.click(saveButton());

    expect(await screen.findByText("Settings saved")).toBeTruthy();
    const sent = fake.calls.find((fakeCall) => fakeCall.commandName === "settings.update");
    expect(sent?.input).toEqual({ ...SHOP_PROFILE, name: "Prabhat Paints", receiptWidth: "58mm" });
  });

  it("blocks Save while the shop name is empty", async () => {
    renderSettings();

    await replaceText("Shop name", "   ");

    expect(saveButton().disabled).toBe(true);
  });
});
