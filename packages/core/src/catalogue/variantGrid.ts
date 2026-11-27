/** One variant as the grid needs it. */
export interface IGridVariant {
  variantId: string;
  axes: Readonly<Record<string, string>>;
  stockMilli: number;
  pricePaise: number;
  isActive: boolean;
}

export interface IGridCell {
  variantId: string;
  stockMilli: number;
  pricePaise: number;
  isActive: boolean;
}

/** One tab: the values of axes 3 and 4 it shows, and its rows x columns of cells (null = none). */
export interface IGridTab {
  tabAxes: Record<string, string>;
  rowValues: string[];
  columnValues: string[];
  cells: (IGridCell | null)[][];
}

export interface IVariantGrid {
  tabs: IGridTab[];
}

/** Each distinct value of `key` in the order the variants first show it ("" when there is no axis). */
function distinctValues(variants: readonly IGridVariant[], key: string | undefined): string[] {
  if (key === undefined) return [""];
  return [...new Set(variants.map((variant) => variant.axes[key] ?? ""))];
}

const tabKeyOf = (tabAxisKeys: readonly string[], axes: Readonly<Record<string, string>>) =>
  JSON.stringify(tabAxisKeys.map((key) => axes[key] ?? ""));

const toCell = ({ variantId, stockMilli, pricePaise, isActive }: IGridVariant): IGridCell => ({
  variantId,
  stockMilli,
  pricePaise,
  isActive,
});

/**
 * The variant grid of research D15: axis 1 on rows, axis 2 on columns, axes 3 and 4 as tabs, in
 * the order values first appear. A combination with no variant is an empty cell (null); an
 * inactive variant's cell keeps `isActive: false` so the screen can mark it. Every tab has the
 * same rows and columns. A family with no axes (a 001 item) is one tab with one cell.
 */
export function buildVariantGrid(
  axisKeys: readonly string[],
  variants: readonly IGridVariant[],
): IVariantGrid {
  const [rowKey, columnKey, ...tabAxisKeys] = axisKeys;
  const rowValues = distinctValues(variants, rowKey);
  const columnValues = distinctValues(variants, columnKey);
  const variantsByTab = new Map<string, IGridVariant[]>();
  variants.forEach((variant) => {
    const tabKey = tabKeyOf(tabAxisKeys, variant.axes);
    variantsByTab.set(tabKey, [...(variantsByTab.get(tabKey) ?? []), variant]);
  });
  const tabs = [...variantsByTab.values()].map((tabVariants) => {
    const cellAt = (rowValue: string, columnValue: string) => {
      const match = tabVariants.find(
        (variant) =>
          (rowKey === undefined || variant.axes[rowKey] === rowValue) &&
          (columnKey === undefined || variant.axes[columnKey] === columnValue),
      );
      return match ? toCell(match) : null;
    };
    return {
      tabAxes: Object.fromEntries(tabAxisKeys.map((key) => [key, tabVariants[0]!.axes[key] ?? ""])),
      rowValues,
      columnValues,
      cells: rowValues.map((rowValue) =>
        columnValues.map((columnValue) => cellAt(rowValue, columnValue)),
      ),
    };
  });
  return { tabs };
}
