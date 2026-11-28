import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IFamilyGrid, IItemSearchRow } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { buildItem } from "../../../../../tests/helpers/itemFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { uiText } from "../../../shared/text/strings";
import { NewBillScreen } from "./NewBillScreen";

/** Spec 002 T038: a family in the bill search opens its grid; the chosen variant is billed. */
const ONE_INCH = buildItem({ id: "pipe-1", name: "PVC Pipe 1 in", pricePaise: 18_000 });
const FAMILY_ROW: IItemSearchRow = {
  kind: "family",
  id: "pipe-family",
  displayName: "PVC Pipe Supreme",
  matchedBy: "whole_word",
  stockMilli: 10_000,
  pricePaise: 18_000,
  item: null,
};
const GRID: IFamilyGrid = {
  axisKeys: ["size"],
  tabs: [
    {
      tabAxes: {},
      rowValues: ["1 in"],
      columnValues: [""],
      cells: [[{ variantId: "pipe-1", stockMilli: 10_000, pricePaise: 18_000, isActive: true }]],
    },
  ],
  items: [ONE_INCH],
};

describe("bill screen: families (spec 002 T038)", () => {
  it("shows a family row in the search, opens its grid, and bills the chosen variant", async () => {
    installFakeShopos({
      "bills.draft.load": () => ({ payload: null }),
      "bills.draft.save": () => ({}),
      "items.search": () => ({ results: [FAMILY_ROW] }),
      "families.grid": () => GRID,
    });
    renderWithTheme(
      <ToastProvider>
        <NewBillScreen />
      </ToastProvider>,
    );

    await userEvent.type(screen.getByRole("textbox", { name: /Type 2 or more letters/ }), "pipe");
    const familyOption = await screen.findByRole("option", { name: /PVC Pipe Supreme/ });
    await userEvent.click(familyOption);
    await userEvent.click(await screen.findByRole("button", { name: /PVC Pipe 1 in: ₹180\.00/ }));

    expect(familyOption.textContent).toContain(uiText.bill.grid.familyRow);
    expect(await screen.findByText("PVC Pipe 1 in")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
