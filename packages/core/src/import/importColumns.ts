import { AXIS_KEYS, type AxisKey } from "../catalogue/axisSignature";

/** A problem in an imported file: its row (1 is the header) and column, in words. */
export interface IImportError {
  row: number;
  column: string;
  message: string;
}

/** The item file's own columns (our template; OI-3 maps a Tally export onto it). */
export const ITEM_COLUMNS = {
  family: "Family",
  kind: "Kind",
  brand: "Brand",
  category: "Category",
  unit: "Unit",
  price: "Price",
  purchasePrice: "Purchase price",
  opening: "Opening stock",
  hsn: "HSN",
  petroleumClass: "Petroleum class",
  declaredQuantity: "Declared quantity",
  declaredUnit: "Declared unit",
  sealedPack: "Sealed pack",
} as const;
export type ItemColumn = keyof typeof ITEM_COLUMNS;

const REQUIRED: readonly ItemColumn[] = ["family", "unit", "price"];

/** "pack_size" is headed "Pack size"; "brand" is the family's brand, not an attribute. */
const axisLabel = (key: AxisKey) => key.charAt(0).toUpperCase() + key.slice(1).replace("_", " ");
const ATTRIBUTE_KEYS = AXIS_KEYS.filter((key) => key !== "brand");

export interface IColumnMap {
  indexOf: Partial<Record<ItemColumn, number>>;
  attributes: { key: AxisKey; label: string; index: number }[];
  errors: IImportError[];
}

/** Where each known column is, by its header, ignoring case and spaces at the ends. */
export function mapItemColumns(header: readonly string[]): IColumnMap {
  const position = (label: string) =>
    header.findIndex((cell) => cell.trim().toLowerCase() === label.toLowerCase());
  const indexOf: IColumnMap["indexOf"] = {};
  (Object.keys(ITEM_COLUMNS) as ItemColumn[]).forEach((column) => {
    const index = position(ITEM_COLUMNS[column]);
    if (index >= 0) indexOf[column] = index;
  });
  const attributes = ATTRIBUTE_KEYS.map((key) => ({
    key,
    label: axisLabel(key),
    index: position(axisLabel(key)),
  })).filter((attribute) => attribute.index >= 0);
  const errors = REQUIRED.filter((column) => indexOf[column] === undefined).map((column) => ({
    row: 1,
    column: ITEM_COLUMNS[column],
    message: `The file needs a ${ITEM_COLUMNS[column]} column`,
  }));
  return { indexOf, attributes, errors };
}
