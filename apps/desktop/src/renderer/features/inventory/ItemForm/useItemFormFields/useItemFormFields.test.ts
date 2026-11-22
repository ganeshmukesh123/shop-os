import { act, renderHook } from "@testing-library/react";
import type { Item } from "@shopos/core";
import { CUSTOM_UNIT_OPTION } from "../constants";
import { useItemFormFields } from "./useItemFormFields";

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

describe("useItemFormFields: a new item", () => {
  it("starts empty, in pieces, with whole numbers only", () => {
    const { result } = renderHook(() => useItemFormFields());

    expect(result.current).toMatchObject({
      name: "",
      unit: "pcs",
      unitChoice: "pcs",
      priceText: "",
      openingText: "",
      allowsDecimal: false,
      isEditing: false,
    });
  });

  it("allows decimals by default for a unit that is measured, such as metre", () => {
    const { result } = renderHook(() => useItemFormFields());

    act(() => result.current.chooseUnit("metre"));

    expect(result.current.unit).toBe("metre");
    expect(result.current.allowsDecimal).toBe(true);
  });

  it("uses the trimmed custom name as the unit when Custom is chosen", () => {
    const { result } = renderHook(() => useItemFormFields());

    act(() => result.current.chooseUnit(CUSTOM_UNIT_OPTION));
    act(() => result.current.setCustomUnit("  bag "));

    expect(result.current.unit).toBe("bag");
  });

  it("keeps a decimal choice for a custom unit, and forgets it when another unit is chosen", () => {
    const { result } = renderHook(() => useItemFormFields());
    act(() => result.current.chooseUnit(CUSTOM_UNIT_OPTION));
    act(() => result.current.setAllowsDecimal(true));
    expect(result.current.allowsDecimal).toBe(true);

    act(() => result.current.chooseUnit("pcs"));

    expect(result.current.allowsDecimal).toBe(false);
  });
});

describe("useItemFormFields: editing an item", () => {
  it("starts from the item's name, price in rupees, unit and decimal setting", () => {
    const { result } = renderHook(() => useItemFormFields(PIPE));

    expect(result.current).toMatchObject({
      name: "Pipe 20mm",
      priceText: "120.00",
      unit: "pcs",
      allowsDecimal: false,
      isEditing: true,
    });
  });

  it("selects Custom and fills the custom name when the item's unit is not in the list", () => {
    const { result } = renderHook(() => useItemFormFields({ ...PIPE, unit: "bag" }));

    expect(result.current.unitChoice).toBe(CUSTOM_UNIT_OPTION);
    expect(result.current.customUnit).toBe("bag");
    expect(result.current.unit).toBe("bag");
  });
});
