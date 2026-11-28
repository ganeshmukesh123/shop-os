import { readItemImportRows } from "../../src/import/itemImportRows";

/**
 * Spec 002 T070 (FR-011, research D12): the rows of an item file become families and variants;
 * every problem is reported with its row and column, nothing is guessed.
 */
const HEADER = [
  "Family",
  "Kind",
  "Brand",
  "Size",
  "Class",
  "Unit",
  "Price",
  "Opening stock",
  "HSN",
];

describe("readItemImportRows (spec 002 T070)", () => {
  it("groups rows into families with their attributes, units, prices and opening stock", () => {
    const read = readItemImportRows([
      HEADER,
      ["PVC Pipe", "", "Supreme", "1 in", "4 kg", "pcs", "120", "10", "3917"],
      ["PVC Pipe", "", "Supreme", "1 in", "6 kg", "pcs", "150.50", "", "3917"],
      ["Copper wire", "", "", "", "", "metre", "45", "180.5", ""],
    ]);

    expect(read.errors).toEqual([]);
    expect(read.families).toEqual([
      {
        name: "PVC Pipe",
        kind: "general",
        brandName: "Supreme",
        categoryName: null,
        axisKeys: ["size", "class"],
        rowNumbers: [2, 3],
        variants: [
          expect.objectContaining({
            axes: { size: "1 in", class: "4 kg" },
            baseUom: "pcs",
            allowDecimal: false,
            sellingPricePaise: 12_000,
            openingQtyMilli: 10_000,
            hsnCode: "3917",
          }),
          expect.objectContaining({
            axes: { size: "1 in", class: "6 kg" },
            sellingPricePaise: 15_050,
            openingQtyMilli: 0,
          }),
        ],
      },
      expect.objectContaining({
        name: "Copper wire",
        axisKeys: [],
        variants: [
          expect.objectContaining({
            axes: {},
            baseUom: "metre",
            allowDecimal: true,
            openingQtyMilli: 180_500,
            hsnCode: null,
          }),
        ],
      }),
    ]);
  });

  it("reports a missing unit, a bad HSN and a bad number with row and column", () => {
    const read = readItemImportRows([
      HEADER,
      ["Elbow", "", "", "1 in", "", "", "45", "", ""],
      ["Tee", "", "", "1 in", "", "pcs", "45", "", "391"],
      ["Bend", "", "", "1 in", "", "pcs", "forty", "", ""],
    ]);

    expect(read.errors).toEqual([
      { row: 2, column: "Unit", message: "Unit is required" },
      { row: 3, column: "HSN", message: "HSN must be 4, 6 or 8 digits" },
      { row: 4, column: "Price", message: "Price must be rupees, like 45 or 45.50" },
    ]);
    expect(read.families).toEqual([]);
  });

  it("lists units the shop does not have, once each", () => {
    const read = readItemImportRows(
      [
        HEADER,
        ["Rope", "", "", "", "", "coil", "90", "", ""],
        ["Twine", "", "", "", "", "coil", "40", "", ""],
      ],
      { knownUnits: ["pcs", "metre"] },
    );

    expect(read.missingUnits).toEqual(["coil"]);
    expect(read.errors.map((error) => [error.row, error.column])).toEqual([
      [2, "Unit"],
      [3, "Unit"],
    ]);
  });

  it("needs the paint fields for a thinner", () => {
    const read = readItemImportRows([
      ["Family", "Kind", "Unit", "Price", "Petroleum class", "Declared quantity", "Declared unit"],
      ["Thinner", "thinner_solvent", "pcs", "180", "", "", ""],
      ["Turpentine", "thinner_solvent", "pcs", "220", "B", "1", "litre"],
    ]);

    expect(read.errors).toEqual([
      {
        row: 2,
        column: "Petroleum class",
        message: "Petroleum class is required for paint, thinner and solvent items",
      },
      {
        row: 2,
        column: "Declared quantity",
        message: "Declared quantity is required for paint, thinner and solvent items",
      },
    ]);
    expect(read.families[0]!.variants[0]).toMatchObject({
      petroleumClass: "B",
      declaredQtyMilli: 1_000,
      declaredUom: "litre",
      sealedPackOnly: false,
    });
  });

  it("refuses a file without the Family, Unit or Price column", () => {
    const read = readItemImportRows([
      ["Name", "Price"],
      ["Elbow", "45"],
    ]);

    expect(read.errors).toEqual([
      { row: 1, column: "Family", message: "The file needs a Family column" },
      { row: 1, column: "Unit", message: "The file needs a Unit column" },
    ]);
  });
});
