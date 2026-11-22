import { validateItemForm } from "./validateItemForm";
import type { IItemFormValues } from "./types";

const VALID_NEW_ITEM: IItemFormValues = {
  name: "Pipe 20mm",
  unit: "pcs",
  priceText: "120",
  openingText: "10",
  allowsDecimal: false,
  isEditing: false,
};

const validate = (overrides: Partial<IItemFormValues>) =>
  validateItemForm({ ...VALID_NEW_ITEM, ...overrides });

describe("validateItemForm: a form that can be saved", () => {
  it("reads the price in paise and the opening stock in thousandths", () => {
    expect(validate({})).toEqual({ errors: [], pricePaise: 12000, openingQtyMilli: 10000 });
  });

  it("reads a price with paise", () => {
    expect(validate({ priceText: "49.50" }).pricePaise).toBe(4950);
  });

  it("takes an empty opening quantity as zero", () => {
    expect(validate({ openingText: "  " })).toEqual({
      errors: [],
      pricePaise: 12000,
      openingQtyMilli: 0,
    });
  });

  it("accepts a fraction for a unit that allows decimals", () => {
    expect(validate({ unit: "metre", allowsDecimal: true, openingText: "2.5" })).toEqual({
      errors: [],
      pricePaise: 12000,
      openingQtyMilli: 2500,
    });
  });
});

describe("validateItemForm: what is wrong", () => {
  it("asks for the name, with spaces alone counting as empty", () => {
    expect(validate({ name: "   " }).errors).toEqual(["Enter the item name"]);
  });

  it("asks for a unit", () => {
    expect(validate({ unit: "" }).errors).toEqual(["Choose or type a unit"]);
  });

  it("limits the unit name to 20 characters", () => {
    expect(validate({ unit: "x".repeat(21), allowsDecimal: true }).errors).toEqual([
      "Unit name can be at most 20 characters",
    ]);
    expect(validate({ unit: "x".repeat(20), allowsDecimal: true }).errors).toEqual([]);
  });

  it("asks for a price it can read, and gives null for the price", () => {
    const priceProblem = validate({ priceText: "abc" });

    expect(priceProblem.errors).toEqual(["Enter the price in rupees, for example 120 or 49.50"]);
    expect(priceProblem.pricePaise).toBeNull();
  });

  it("refuses an opening quantity that is not a number", () => {
    expect(validate({ openingText: "ten" }).errors).toEqual([
      "Enter the opening quantity as a number, for example 10 or 2.5",
    ]);
  });

  it("refuses a fraction for a unit that takes whole numbers only", () => {
    expect(validate({ openingText: "2.5" }).errors).toEqual([
      "This unit accepts whole numbers only",
    ]);
  });

  it("lists every problem, in the order of the fields", () => {
    expect(validate({ name: "", unit: "", priceText: "", openingText: "x" }).errors).toEqual([
      "Enter the item name",
      "Choose or type a unit",
      "Enter the price in rupees, for example 120 or 49.50",
      "Enter the opening quantity as a number, for example 10 or 2.5",
    ]);
  });
});

describe("validateItemForm: editing an item", () => {
  it("ignores the opening quantity, which an edit never sends", () => {
    expect(validate({ isEditing: true, openingText: "2.5" })).toEqual({
      errors: [],
      pricePaise: 12000,
      openingQtyMilli: 0,
    });
  });
});
