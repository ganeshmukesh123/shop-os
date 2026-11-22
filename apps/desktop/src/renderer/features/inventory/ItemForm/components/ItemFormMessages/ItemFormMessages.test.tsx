import { screen } from "@testing-library/react";
import type { Item } from "@shopos/core";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { ItemFormMessages } from "./ItemFormMessages";

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

const COIL: Item = { ...PIPE, id: "item-2", name: "Pipe 20mm", unit: "metre", stockMilli: 2500 };

describe("ItemFormMessages", () => {
  it("shows nothing when there is nothing to say", () => {
    renderWithTheme(<ItemFormMessages errors={[]} duplicateItems={[]} />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Duplicate name")).toBeNull();
  });

  it("shows each error with the word Error before it", () => {
    renderWithTheme(
      <ItemFormMessages
        errors={["Enter the item name", "Choose or type a unit"]}
        duplicateItems={[]}
      />,
    );

    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual([
      "Error Enter the item name",
      "Error Choose or type a unit",
    ]);
  });

  it("shows the Duplicate name word, what to do, and each existing item with its stock", () => {
    renderWithTheme(<ItemFormMessages errors={[]} duplicateItems={[PIPE, COIL]} />);

    const warning = screen.getByText(/Pipe 20mm \(10 pcs in stock\)/);
    expect(warning.textContent).toBe(
      "Duplicate name An item with this name already exists. Change the name to save. Existing items: Pipe 20mm (10 pcs in stock); Pipe 20mm (2.5 metre in stock)",
    );
  });
});
