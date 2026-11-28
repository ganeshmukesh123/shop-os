import * as XLSX from "xlsx";
import { readSheetRows } from "./sheetRows";

/**
 * Spec 002 T076 (OD-2, SheetJS CE approved by the owner): an item or shade file, XLSX or CSV,
 * read as rows of text. The import rules (core) then check every cell.
 */
function xlsxBytes(rows: unknown[][]): Uint8Array {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Items");
  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

describe("readSheetRows (spec 002 T076)", () => {
  it("reads the first sheet of an .xlsx file as text, numbers as typed", () => {
    const rows = readSheetRows(
      xlsxBytes([
        ["Name", "Unit", "Price"],
        ["PVC Pipe 1 in", "pcs", 120],
        ["Copper wire", "metre", 45.5],
      ]),
    );

    expect(rows).toEqual([
      ["Name", "Unit", "Price"],
      ["PVC Pipe 1 in", "pcs", "120"],
      ["Copper wire", "metre", "45.5"],
    ]);
  });

  it("reads a CSV with a quoted comma and Hindi text, keeping empty cells", () => {
    const csv = 'Name,Hindi name,Price\n"Elbow, 1 in",कोहनी,45\nTape,,20\n';

    expect(readSheetRows(new TextEncoder().encode(csv))).toEqual([
      ["Name", "Hindi name", "Price"],
      ["Elbow, 1 in", "कोहनी", "45"],
      ["Tape", "", "20"],
    ]);
  });

  it("keeps a formula's saved value, never the formula", () => {
    const sheet = XLSX.utils.aoa_to_sheet([["Price"], [10]]);
    // SheetJS's own cell format: t (type), f (formula), v (saved value)
    // eslint-disable-next-line id-length
    sheet.A3 = { t: "n", f: "A2*2", v: 20 };
    sheet["!ref"] = "A1:A3";
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Items");
    const bytes = new Uint8Array(
      XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer,
    );

    expect(readSheetRows(bytes)).toEqual([["Price"], ["10"], ["20"]]);
  });

  it("gives no rows for an empty file", () => {
    expect(readSheetRows(new Uint8Array())).toEqual([]);
  });
});
