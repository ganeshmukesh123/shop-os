import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { CUSTOM_UNIT_OPTION } from "../../constants";
import type { IItemFormFields } from "../../useItemFormFields";
import { ItemUnitFields } from "./ItemUnitFields";

function buildFields(overrides: Partial<IItemFormFields> = {}): IItemFormFields {
  return {
    name: "",
    unitChoice: "pcs",
    customUnit: "",
    priceText: "",
    openingText: "",
    unit: "pcs",
    allowsDecimal: false,
    isEditing: false,
    setName: vi.fn(),
    chooseUnit: vi.fn(),
    setCustomUnit: vi.fn(),
    setAllowsDecimal: vi.fn(),
    setPriceText: vi.fn(),
    setOpeningText: vi.fn(),
    ...overrides,
  };
}

const decimalCheckbox = () =>
  screen.getByRole("checkbox", { name: "Allow decimal quantities" }) as HTMLButtonElement;

describe("ItemUnitFields", () => {
  it("shows the unit list with the chosen unit, and no custom name field", () => {
    renderWithTheme(<ItemUnitFields fields={buildFields()} />);

    expect(screen.getByRole("combobox", { name: "Unit" }).textContent).toContain("pcs");
    expect(screen.queryByRole("textbox", { name: "Custom unit name" })).toBeNull();
  });

  it("reports the unit picked from the list", async () => {
    const fields = buildFields();
    renderWithTheme(<ItemUnitFields fields={fields} />);

    await userEvent.click(screen.getByRole("combobox", { name: "Unit" }));
    await userEvent.click(await screen.findByRole("option", { name: "metre" }));

    expect(fields.chooseUnit).toHaveBeenCalledWith("metre");
  });

  it("shows the custom name field, and reports what is typed, when Custom is chosen", async () => {
    const fields = buildFields({ unitChoice: CUSTOM_UNIT_OPTION, unit: "" });
    renderWithTheme(<ItemUnitFields fields={fields} />);

    await userEvent.type(screen.getByRole("textbox", { name: "Custom unit name" }), "b");

    expect(fields.setCustomUnit).toHaveBeenCalledWith("b");
  });

  it("lets the decimal setting be changed only for a custom unit", async () => {
    const fields = buildFields({ unitChoice: CUSTOM_UNIT_OPTION, unit: "bag" });
    renderWithTheme(<ItemUnitFields fields={fields} />);
    expect(decimalCheckbox().disabled).toBe(false);

    await userEvent.click(decimalCheckbox());

    expect(fields.setAllowsDecimal).toHaveBeenCalledWith(true);
  });

  it("locks the decimal setting for a listed unit, and when editing an item", () => {
    const { unmount } = renderWithTheme(<ItemUnitFields fields={buildFields()} />);
    expect(decimalCheckbox().disabled).toBe(true);
    unmount();

    renderWithTheme(
      <ItemUnitFields fields={buildFields({ unitChoice: CUSTOM_UNIT_OPTION, isEditing: true })} />,
    );
    expect(decimalCheckbox().disabled).toBe(true);
  });
});
