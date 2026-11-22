import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Item } from "@shopos/core";
import { ToastProvider } from "../../../src/renderer/shared/components/Toast";
import { NewBillScreen } from "../../../src/renderer/screens/NewBillScreen";
import { installFakeShopos } from "../../helpers/fakeShopos";
import { renderWithTheme } from "../../helpers/renderWithTheme";

const PIPE: Item = {
  id: "item-1",
  name: "Pipe 20mm",
  unit: "pcs",
  allowsDecimal: false,
  pricePaise: 12000,
  stockMilli: 10000,
  active: true,
  needsCorrection: false,
};

const ELBOW: Item = { ...PIPE, id: "item-2", name: "Pipe elbow", pricePaise: 4500 };

function renderBillScreen() {
  installFakeShopos({
    "bills.draft.load": () => ({ payload: null }),
    "bills.draft.save": () => ({}),
    "items.list": () => ({ items: [PIPE, ELBOW], total: 2 }),
  });
  return renderWithTheme(
    <ToastProvider>
      <NewBillScreen />
    </ToastProvider>,
  );
}

describe("bill screen: item search dropdown", () => {
  it("lists matches in a styled listbox once two letters are typed", async () => {
    renderBillScreen();

    await userEvent.type(screen.getByRole("textbox", { name: /Type 2 or more letters/ }), "pi");

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.className)).toEqual([
      "shopos-search-result",
      "shopos-search-result",
    ]);
    expect(screen.getByRole("listbox", { name: "Matching items" }).className).toBe(
      "shopos-search-results",
    );
  });

  it("marks the highlighted match with aria-selected, so it is not colour alone", async () => {
    renderBillScreen();
    await userEvent.type(screen.getByRole("textbox", { name: /Type 2 or more letters/ }), "pi");
    await screen.findAllByRole("option");

    await userEvent.keyboard("{ArrowDown}");

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
    ]);
  });

  it("adds the top match to the bill when Enter is pressed", async () => {
    renderBillScreen();

    await userEvent.type(
      screen.getByRole("textbox", { name: /Type 2 or more letters/ }),
      "pi{Enter}",
    );

    expect(await screen.findByRole("textbox", { name: "Qty Pipe 20mm" })).toBeTruthy();
  });
});
