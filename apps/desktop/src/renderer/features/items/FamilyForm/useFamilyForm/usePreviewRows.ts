import { useState } from "react";
import type { IVariantCombinationPreview } from "@shopos/core";
import type { IPreviewRow } from "./types";

/** The combination table: every previewed row starts ticked, with no price or opening stock. */
export function usePreviewRows() {
  const [rows, setRows] = useState<IPreviewRow[]>([]);

  const updateRow = (axisSignature: string, change: (row: IPreviewRow) => Partial<IPreviewRow>) =>
    setRows((current) =>
      current.map((row) =>
        row.axisSignature === axisSignature ? { ...row, ...change(row) } : row,
      ),
    );

  return {
    rows,
    showCombinations: (combinations: readonly IVariantCombinationPreview[]) =>
      setRows(
        combinations.map((combination) => ({
          ...combination,
          isChosen: true,
          priceText: "",
          openingText: "",
        })),
      ),
    clearRows: () => setRows([]),
    toggleRow: (axisSignature: string) =>
      updateRow(axisSignature, (row) => ({ isChosen: !row.isChosen })),
    setRowPrice: (axisSignature: string, priceText: string) =>
      updateRow(axisSignature, () => ({ priceText })),
    setRowOpening: (axisSignature: string, openingText: string) =>
      updateRow(axisSignature, () => ({ openingText })),
  };
}
