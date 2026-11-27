import { buildVariantGrid, type IGridVariant } from "../../src/catalogue/variantGrid";

/** Spec 002 T026 (research D15): the variant grid a family shows on screen. */
function pipe(axes: Record<string, string>, overrides: Partial<IGridVariant> = {}): IGridVariant {
  const signature = Object.values(axes).join("-");
  return {
    variantId: `pipe-${signature}`,
    axes,
    stockMilli: 10_000,
    pricePaise: 12_000,
    isActive: true,
    ...overrides,
  };
}

describe("buildVariantGrid (spec 002 T026)", () => {
  it("puts axis 1 on rows and axis 2 on columns, in the order the values first appear", () => {
    const grid = buildVariantGrid(
      ["size", "class"],
      [
        pipe({ size: "0.5 in", class: "4 kg" }),
        pipe({ size: "0.5 in", class: "6 kg" }),
        pipe({ size: "1 in", class: "4 kg" }),
        pipe({ size: "1 in", class: "6 kg" }),
      ],
    );

    expect(grid.tabs).toHaveLength(1);
    expect(grid.tabs[0]!.rowValues).toEqual(["0.5 in", "1 in"]);
    expect(grid.tabs[0]!.columnValues).toEqual(["4 kg", "6 kg"]);
    expect(grid.tabs[0]!.cells[1]![0]!.variantId).toBe("pipe-1 in-4 kg");
  });

  it("leaves an empty cell where a combination is not stocked", () => {
    const grid = buildVariantGrid(
      ["size", "class"],
      [
        pipe({ size: "0.5 in", class: "4 kg" }),
        pipe({ size: "1 in", class: "4 kg" }),
        pipe({ size: "1 in", class: "6 kg" }),
      ],
    );

    expect(grid.tabs[0]!.cells[0]).toEqual([
      expect.objectContaining({ variantId: "pipe-0.5 in-4 kg" }),
      null,
    ]);
  });

  it("marks an inactive variant's cell and keeps its stock and price", () => {
    const grid = buildVariantGrid(
      ["size"],
      [pipe({ size: "1 in" }, { isActive: false, stockMilli: -2000, pricePaise: 9900 })],
    );

    expect(grid.tabs[0]!.cells[0]![0]).toEqual({
      variantId: "pipe-1 in",
      stockMilli: -2000,
      pricePaise: 9900,
      isActive: false,
    });
  });

  it("makes one column when there is one axis", () => {
    const grid = buildVariantGrid(["size"], [pipe({ size: "1 in" }), pipe({ size: "2 in" })]);

    expect(grid.tabs[0]!.rowValues).toEqual(["1 in", "2 in"]);
    expect(grid.tabs[0]!.columnValues).toEqual([""]);
    expect(grid.tabs[0]!.cells.map((row) => row.length)).toEqual([1, 1]);
  });

  it("turns axes 3 and 4 into tabs, each holding the same rows and columns", () => {
    const variants = [
      pipe({ size: "1 in", class: "4 kg", brand: "Supreme", length: "3 m" }),
      pipe({ size: "1 in", class: "6 kg", brand: "Finolex", length: "3 m" }),
      pipe({ size: "2 in", class: "4 kg", brand: "Supreme", length: "6 m" }),
    ];

    const grid = buildVariantGrid(["size", "class", "brand", "length"], variants);

    expect(grid.tabs.map((tab) => tab.tabAxes)).toEqual([
      { brand: "Supreme", length: "3 m" },
      { brand: "Finolex", length: "3 m" },
      { brand: "Supreme", length: "6 m" },
    ]);
    expect(grid.tabs[0]!.cells).toEqual([
      [expect.objectContaining({ variantId: "pipe-1 in-4 kg-Supreme-3 m" }), null],
      [null, null],
    ]);
    expect(grid.tabs[1]!.rowValues).toEqual(["1 in", "2 in"]);
  });

  it("gives one cell for a family with no axes (a 001 item)", () => {
    const grid = buildVariantGrid([], [pipe({}, { variantId: "elbow" })]);

    expect(grid.tabs).toEqual([
      {
        tabAxes: {},
        rowValues: [""],
        columnValues: [""],
        cells: [[{ variantId: "elbow", stockMilli: 10_000, pricePaise: 12_000, isActive: true }]],
      },
    ]);
  });
});
