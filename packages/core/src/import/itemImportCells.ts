import {
  FAMILY_KINDS,
  PETROLEUM_CLASSES,
  type FamilyKind,
  type PetroleumClass,
} from "../catalogue/variantDraft";
import { parseRupees } from "../money";
import { defaultAllowsDecimal, isValidQuantity, parseQuantity } from "../quantity";
import { ITEM_COLUMNS, type IColumnMap, type IImportError, type ItemColumn } from "./importColumns";

/** One good row of an item file, ready to become a variant of its family. */
export interface IImportedRow {
  rowNumber: number;
  familyName: string;
  kind: FamilyKind;
  brandName: string | null;
  categoryName: string | null;
  attributeValues: Record<string, string>;
  variant: {
    baseUom: string;
    allowDecimal: boolean;
    sellingPricePaise: number;
    purchasePricePaise: number | null;
    openingQtyMilli: number;
    hsnCode: string | null;
    petroleumClass: PetroleumClass | null;
    declaredQtyMilli: number | null;
    declaredUom: string | null;
    sealedPackOnly: boolean;
  };
}

/** A cell read: its value, or what is wrong with it. */
type Reading<TValue> = { value: TValue } | { error: string };
const ok = <TValue>(value: TValue): Reading<TValue> => ({ value });
const wrong = <TValue>(error: string): Reading<TValue> => ({ error });
const valueOf = <TValue>(reading: Reading<TValue>) => (reading as { value: TValue }).value;

const PAINT_RULE = "is required for paint, thinner and solvent items";
const YES = ["yes", "y", "true", "1"];
const HSN_PATTERN = /^(\d{4}|\d{6}|\d{8})$/;

const readKind = (text: string): Reading<FamilyKind> =>
  (FAMILY_KINDS as readonly string[]).includes(text || "general")
    ? ok((text || "general") as FamilyKind)
    : wrong(`Kind must be one of ${FAMILY_KINDS.join(", ")}`);

function readUnit(text: string, knownUnits?: readonly string[]): Reading<string> {
  if (text === "") return wrong("Unit is required");
  return knownUnits && !knownUnits.includes(text)
    ? wrong(`Unit "${text}" is not one of the shop's units`)
    : ok(text);
}

const readPrice = (text: string): Reading<number> => {
  const paise = parseRupees(text);
  return paise === null ? wrong("Price must be rupees, like 45 or 45.50") : ok(paise);
};

function readOpening(text: string, allowDecimal: boolean): Reading<number> {
  if (text === "") return ok(0);
  const quantity = parseQuantity(text);
  const isFine = quantity !== null && quantity >= 0 && isValidQuantity(quantity, allowDecimal);
  return isFine ? ok(quantity) : wrong("Opening stock must be a number this unit takes, like 10");
}

const readHsn = (text: string): Reading<string | null> =>
  text === "" || HSN_PATTERN.test(text) ? ok(text || null) : wrong("HSN must be 4, 6 or 8 digits");

function readClass(text: string, isPaint: boolean): Reading<PetroleumClass | null> {
  const upper = text.toUpperCase();
  if ((PETROLEUM_CLASSES as readonly string[]).includes(upper)) return ok(upper as PetroleumClass);
  return isPaint ? wrong(`Petroleum class ${PAINT_RULE}`) : ok(null);
}

function readDeclared(text: string, isPaint: boolean): Reading<number | null> {
  const quantity = parseQuantity(text);
  if (quantity !== null && quantity > 0) return ok(quantity);
  return isPaint ? wrong(`Declared quantity ${PAINT_RULE}`) : ok(null);
}

type ICell = (column: ItemColumn) => string;

/** Every checked cell of the row, in column order. */
function readingsOf(cell: ICell, knownUnits?: readonly string[]) {
  const kind = readKind(cell("kind"));
  const isPaint = "value" in kind && kind.value !== "general";
  return {
    family: cell("family") ? ok(cell("family")) : wrong<string>("Family is required"),
    kind,
    unit: readUnit(cell("unit"), knownUnits),
    price: readPrice(cell("price")),
    opening: readOpening(cell("opening"), defaultAllowsDecimal(cell("unit"))),
    hsn: readHsn(cell("hsn")),
    petroleumClass: readClass(cell("petroleumClass"), isPaint),
    declaredQuantity: readDeclared(cell("declaredQuantity"), isPaint),
  };
}
type IReadings = ReturnType<typeof readingsOf>;

const errorsOf = (readings: IReadings, rowNumber: number): IImportError[] =>
  (Object.keys(readings) as (keyof IReadings)[]).flatMap((column) => {
    const reading = readings[column];
    return "error" in reading
      ? [{ row: rowNumber, column: ITEM_COLUMNS[column], message: reading.error }]
      : [];
  });

/** The row's attribute values that are filled in, by attribute key. */
const attributeValuesOf = (cells: readonly string[], columns: IColumnMap) =>
  Object.fromEntries(
    columns.attributes
      .map(({ key, index }) => [key, (cells[index] ?? "").trim()] as const)
      .filter(([, value]) => value !== ""),
  );

function variantOf(cell: ICell, readings: IReadings): IImportedRow["variant"] {
  const isPaint = valueOf(readings.kind) !== "general";
  return {
    baseUom: valueOf(readings.unit),
    allowDecimal: defaultAllowsDecimal(valueOf(readings.unit)),
    sellingPricePaise: valueOf(readings.price),
    purchasePricePaise: parseRupees(cell("purchasePrice")),
    openingQtyMilli: valueOf(readings.opening),
    hsnCode: valueOf(readings.hsn),
    petroleumClass: valueOf(readings.petroleumClass),
    declaredQtyMilli: valueOf(readings.declaredQuantity),
    declaredUom: isPaint ? cell("declaredUnit") || null : null,
    sealedPackOnly: YES.includes(cell("sealedPack").toLowerCase()),
  };
}

/**
 * Read and check one row (spec 002 T070): every problem is listed with its column, and a row
 * with a problem gives no row. A unit the shop does not have is a problem when `knownUnits` is
 * given. Paint, thinner and solvent rows need a petroleum class and a declared quantity (D10).
 */
export function readItemRow(
  cells: readonly string[],
  rowNumber: number,
  columns: IColumnMap,
  knownUnits?: readonly string[],
): { row: IImportedRow | null; errors: IImportError[] } {
  const cell: ICell = (column) => (cells[columns.indexOf[column] ?? -1] ?? "").trim();
  const readings = readingsOf(cell, knownUnits);
  const errors = errorsOf(readings, rowNumber);
  if (errors.length > 0) return { row: null, errors };
  const row: IImportedRow = {
    rowNumber,
    familyName: valueOf(readings.family),
    kind: valueOf(readings.kind),
    brandName: cell("brand") || null,
    categoryName: cell("category") || null,
    attributeValues: attributeValuesOf(cells, columns),
    variant: variantOf(cell, readings),
  };
  return { row, errors };
}
