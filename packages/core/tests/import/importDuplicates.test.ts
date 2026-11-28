import { findImportDuplicates } from "../../src/import/importDuplicates";
import { readItemImportRows } from "../../src/import/itemImportRows";

/** Spec 002 T070 (FR-008): duplicate rows in the file, and rows like items the shop already has. */
const HEADER = ["Family", "Size", "Unit", "Price"];

describe("findImportDuplicates (spec 002 T070)", () => {
  it("groups two rows of the same family and size, and a row like an existing item", () => {
    const { families } = readItemImportRows([
      HEADER,
      ["Elbow", "1 in", "pcs", "45"],
      ["Tee", "1 in", "pcs", "50"],
      ["elbow", "1 in", "pcs", "46"],
      ["PVC Pipe", "1 in", "pcs", "120"],
    ]);

    const groups = findImportDuplicates(families, [
      {
        variantId: "pipe-1",
        displayName: "PVC Pipe 1 in",
        brandId: null,
        categoryId: null,
        axisSignature: "size=1 in",
      },
    ]);

    expect(groups).toEqual([
      { rows: [2, 4], existing: [] },
      {
        rows: [5],
        existing: [{ variantId: "pipe-1", displayName: "PVC Pipe 1 in", reason: "similar_name" }],
      },
    ]);
  });

  it("finds nothing in a clean file of new items", () => {
    const { families } = readItemImportRows([HEADER, ["Gate valve", "1 in", "pcs", "300"]]);

    expect(findImportDuplicates(families, [])).toEqual([]);
  });
});
