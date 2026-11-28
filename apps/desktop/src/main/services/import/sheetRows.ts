import * as XLSX from "xlsx";

/**
 * The first sheet of an item or shade file, XLSX or CSV, as rows of text (spec 002 T076, OD-2:
 * SheetJS CE, approved by the owner). Cells come back as shown in the sheet ("45.5"), empty cells
 * as "". Formulas are never evaluated: only the value saved in the file is read.
 */
export function readSheetRows(bytes: Uint8Array): string[][] {
  if (bytes.length === 0) return [];
  const workbook = XLSX.read(bytes, {
    type: "array",
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    codepage: 65001,
  });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  return rows.map((row) => row.map((cell) => String(cell ?? "")));
}
