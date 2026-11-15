import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Item, ShopProfile } from "@shopos/core";
import { ToastProvider, useToast } from "../../../src/renderer/components/Toast";
import { ItemsScreen } from "../../../src/renderer/screens/ItemsScreen";
import { SettingsScreen } from "../../../src/renderer/screens/SettingsScreen";
import { installFakeShopos } from "../../helpers/fakeShopos";
import { renderWithTheme } from "../../helpers/renderWithTheme";

const SHOP_PROFILE: ShopProfile = {
  name: "Prabhat Hardware",
  address: "",
  phone: "",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "",
  receiptWidth: "80mm",
  backupFolder: "/backups",
};

const NEGATIVE_INACTIVE_ITEM: Item = {
  id: "item-1",
  name: "Elbow 1 inch",
  unit: "pcs",
  allowsDecimal: false,
  pricePaise: 4500,
  stockMilli: -3000,
  active: false,
  needsCorrection: true,
};

function ToastButtons() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast("error", "Disk is full")}>fail</button>
      <button onClick={() => toast("success", "Settings saved")}>succeed</button>
    </>
  );
}

describe("status words in the screens (design guidelines 5.1, PRD NFR-011)", () => {
  it("a failure toast opens with the word Error and is announced as an alert", async () => {
    renderWithTheme(
      <ToastProvider>
        <ToastButtons />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "fail" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Error Disk is full");
  });

  it("a success toast opens with the word Done and is announced politely", async () => {
    renderWithTheme(
      <ToastProvider>
        <ToastButtons />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "succeed" }));

    const toastStatus = await screen.findAllByRole("status");
    expect(toastStatus.some((element) => element.textContent === "Done Settings saved")).toBe(true);
  });

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

  it("an item with negative stock and an inactive item each carry a word", async () => {
    installFakeShopos({
      "items.list": () => ({ items: [NEGATIVE_INACTIVE_ITEM], total: 1 }),
    });

    renderWithTheme(
      <ToastProvider>
        <ItemsScreen />
      </ToastProvider>,
    );

    expect(await screen.findByText("Negative stock: needs correction")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
  });
});
