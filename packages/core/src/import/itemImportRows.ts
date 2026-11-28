import type { FamilyKind } from "../catalogue/variantDraft";
import { mapItemColumns, type IImportError } from "./importColumns";
import { readItemRow, type IImportedRow } from "./itemImportCells";

/** A family read from the file, with its variants, ready for families.create. */
export interface IImportFamily {
  name: string;
  kind: FamilyKind;
  brandName: string | null;
  categoryName: string | null;
  axisKeys: string[];
  rowNumbers: number[];
  variants: (IImportedRow["variant"] & { axes: Record<string, string>; rowNumber: number })[];
}

export interface IItemImportRead {
  families: IImportFamily[];
  errors: IImportError[];
  /** Units used in the file that the shop does not have yet, each once */
  missingUnits: string[];
}

/** Rows of the same family name and brand, ignoring case, make one family. */
const familyKeyOf = (row: IImportedRow) =>
  `${row.familyName.toLowerCase()}|${(row.brandName ?? "").toLowerCase()}`;

/** One family from its rows: the attributes any of them uses, in file order (FR-001). */
function toFamily(rows: readonly IImportedRow[], attributeOrder: readonly string[]): IImportFamily {
  const [first] = rows as [IImportedRow];
  const axisKeys = attributeOrder.filter((key) => rows.some((row) => row.attributeValues[key]));
  return {
    name: first.familyName,
    kind: first.kind,
    brandName: first.brandName,
    categoryName: first.categoryName,
    axisKeys,
    rowNumbers: rows.map((row) => row.rowNumber),
    variants: rows.map((row) => ({
      ...row.variant,
      axes: row.attributeValues,
      rowNumber: row.rowNumber,
    })),
  };
}

/**
 * An item file's rows (header first) as families and variants (spec 002 T070, FR-011). Every
 * problem is reported with its row and column; a row with a problem is left out.
 */
export function readItemImportRows(
  rows: readonly (readonly string[])[],
  options: { knownUnits?: readonly string[] } = {},
): IItemImportRead {
  const [header = [], ...body] = rows;
  const columns = mapItemColumns(header);
  if (columns.errors.length > 0) return { families: [], errors: columns.errors, missingUnits: [] };
  const read = body.map((cells, bodyIndex) =>
    readItemRow(cells, bodyIndex + 2, columns, options.knownUnits),
  );
  const good = read.flatMap(({ row }) => (row ? [row] : []));
  const byFamily = new Map<string, IImportedRow[]>();
  good.forEach((row) =>
    byFamily.set(familyKeyOf(row), [...(byFamily.get(familyKeyOf(row)) ?? []), row]),
  );
  const attributeOrder = columns.attributes.map(({ key }) => key);
  const units = body.map((cells) => (cells[columns.indexOf.unit!] ?? "").trim());
  const missingUnits = options.knownUnits
    ? [...new Set(units.filter((unit) => unit && !options.knownUnits!.includes(unit)))]
    : [];
  return {
    families: [...byFamily.values()].map((familyRows) => toFamily(familyRows, attributeOrder)),
    errors: read.flatMap(({ errors }) => errors),
    missingUnits,
  };
}
