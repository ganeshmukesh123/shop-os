import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Item } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { buildItem, searchRowOf } from "../../../../../tests/helpers/itemFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { uiText } from "../../../shared/text/strings";
import { NewBillScreen } from "./NewBillScreen";

/** Spec 002 T052 (EC-07): a scanned code on one item adds it; on two, a chooser opens. */
const ELBOW = buildItem({ id: "elbow", name: "Elbow 1 inch", pricePaise: 4_500 });
const GREY = buildItem({ id: "elbow-grey", name: "Elbow 1 inch grey", pricePaise: 5_000 });
const CODE = "8901234567890";

function renderBill(onCode: Item[], searchRows: Item[] = []) {
  const fake = installFakeShopos({
    "bills.draft.load": () => ({ payload: null }),
    "bills.draft.save": () => ({}),
    "items.search": () => ({ results: searchRows.map(searchRowOf) }),
    "items.lookupBarcode": () => ({ variants: onCode }),
  });
  renderWithTheme(
    <ToastProvider>
      <NewBillScreen />
    </ToastProvider>,
  );
  return fake;
}

const scan = (text: string) =>
  userEvent.type(screen.getByRole("textbox", { name: /Type 2 or more letters/ }), `${text}{Enter}`);

describe("bill screen: scanned codes (spec 002 T052)", () => {
  it("adds the one item a scanned code is on", async () => {
    const fake = renderBill([ELBOW]);

    await scan(CODE);

    expect(await screen.findByText("Elbow 1 inch")).toBeTruthy();
    expect(fake.calls.find((call) => call.commandName === "items.lookupBarcode")?.input).toEqual({
      code: CODE,
    });
  });

  it("asks which item when the code is on two, and bills the one chosen", async () => {
    renderBill([ELBOW, GREY]);

    await scan(CODE);
    const chooser = await screen.findByRole("dialog", {
      name: uiText.bill.barcode.title.replace("{code}", CODE),
    });
    await userEvent.click(screen.getByRole("button", { name: /Elbow 1 inch grey/ }));

    expect(chooser.isConnected).toBe(false);
    expect(await screen.findByText("Elbow 1 inch grey")).toBeTruthy();
  });

  it("falls back to the search when no item has that code", async () => {
    renderBill([], [ELBOW]);

    await userEvent.type(screen.getByRole("textbox", { name: /Type 2 or more letters/ }), "elbow1");
    await screen.findByRole("option", { name: /Elbow 1 inch/ });
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText("Elbow 1 inch")).toBeTruthy();
  });
});
