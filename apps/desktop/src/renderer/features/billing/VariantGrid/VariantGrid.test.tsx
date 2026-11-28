import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IFamilyGrid } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { buildItem } from "../../../../../tests/helpers/itemFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../shared/text/strings";
import { VariantGrid } from "./VariantGrid";

/** Spec 002 T038 (research D15): a family's sizes by class, billed from the grid with the keyboard. */
const HALF_4KG = buildItem({ id: "half-4", name: "PVC Pipe 0.5 in 4 kg", stockMilli: 10_000 });
const HALF_6KG = buildItem({ id: "half-6", name: "PVC Pipe 0.5 in 6 kg", stockMilli: -2_000 });
const ONE_4KG = buildItem({ id: "one-4", name: "PVC Pipe 1 in 4 kg", pricePaise: 18_000 });

const cell = (item: typeof HALF_4KG) => ({
  variantId: item.id,
  stockMilli: item.stockMilli,
  pricePaise: item.pricePaise,
  isActive: true,
});

const GRID: IFamilyGrid = {
  axisKeys: ["size", "class"],
  tabs: [
    {
      tabAxes: {},
      rowValues: ["0.5 in", "1 in"],
      columnValues: ["4 kg", "6 kg"],
      cells: [
        [cell(HALF_4KG), cell(HALF_6KG)],
        [cell(ONE_4KG), null],
      ],
    },
  ],
  items: [HALF_4KG, HALF_6KG, ONE_4KG],
};

function renderGrid() {
  installFakeShopos({ "families.grid": () => GRID });
  const onPick = vi.fn();
  renderWithTheme(
    <VariantGrid familyId="pipe" title="PVC Pipe" onPick={onPick} onClose={vi.fn()} />,
  );
  return onPick;
}

describe("VariantGrid (spec 002 T038)", () => {
  it("puts sizes on rows and classes on columns, with price and stock in each cell", async () => {
    renderGrid();

    expect(await screen.findByRole("rowheader", { name: "0.5 in" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "6 kg" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /0\.5 in 4 kg: ₹120\.00, 10 in stock/ }),
    ).toBeTruthy();
  });

  it("says Negative stock in words, and leaves a combination that is not stocked empty", async () => {
    renderGrid();

    expect(
      await screen.findByRole("button", { name: /0\.5 in 6 kg.*Negative stock/ }),
    ).toBeTruthy();
    expect(screen.getAllByText(uiText.bill.grid.notStocked)).toHaveLength(1);
  });

  it("adds the clicked cell's variant to the bill", async () => {
    const onPick = renderGrid();

    await userEvent.click(await screen.findByRole("button", { name: /1 in 4 kg/ }));

    expect(onPick).toHaveBeenCalledWith(ONE_4KG);
  });

  it("moves with the arrow keys and adds with Enter", async () => {
    const onPick = renderGrid();
    (await screen.findByRole("button", { name: /0\.5 in 4 kg/ })).focus();

    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(onPick).toHaveBeenCalledWith(ONE_4KG);
  });
});
