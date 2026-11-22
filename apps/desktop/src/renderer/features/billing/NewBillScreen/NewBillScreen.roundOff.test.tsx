import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Item, ShopProfile } from "@shopos/core";
import { ToastProvider } from "../../../shared/components/Toast";
import { NewBillScreen } from "./NewBillScreen";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";

// One pipe at ₹849.60: the saved bill is ₹850.00 with a round-off of +₹0.40 (FR-010a).
const PIPE: Item = {
  id: "item-1",
  name: "Pipe 20mm",
  unit: "pcs",
  allowsDecimal: false,
  pricePaise: 84960,
  stockMilli: 10000,
  active: true,
  needsCorrection: false,
};

const SHOP_PROFILE: ShopProfile = {
  name: "Prabhat Hardware",
  address: "",
  phone: "",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "",
  receiptWidth: "80mm",
  backupFolder: "",
  docTitle: "Estimate",
  roundBillTotal: true,
  timeZone: "Asia/Kolkata",
};

async function addOnePipe(profile: ShopProfile) {
  installFakeShopos({
    "bills.draft.load": () => ({ payload: null }),
    "bills.draft.save": () => ({}),
    "items.list": () => ({ items: [PIPE], total: 1 }),
    "settings.get": () => profile,
  });
  renderWithTheme(
    <ToastProvider>
      <NewBillScreen />
    </ToastProvider>,
  );
  await userEvent.type(screen.getByRole("textbox", { name: /Type 2 or more letters/ }), "pi");
  await userEvent.click(await screen.findByRole("option", { name: /Pipe 20mm/ }));
}

describe("new bill screen: the total the cashier collects matches the saved bill", () => {
  it("shows the round-off and the rounded grand total when rounding is on", async () => {
    await addOnePipe(SHOP_PROFILE);

    expect(await screen.findByText("Round off: +₹0.40")).toBeTruthy();
    expect(screen.getByText("Grand total: ₹850.00")).toBeTruthy();
  });

  it("shows the exact total and no round-off line when the shop turns rounding off", async () => {
    await addOnePipe({ ...SHOP_PROFILE, roundBillTotal: false });

    expect(await screen.findByText("Grand total: ₹849.60")).toBeTruthy();
    expect(screen.queryByText(/Round off/)).toBeNull();
  });
});
