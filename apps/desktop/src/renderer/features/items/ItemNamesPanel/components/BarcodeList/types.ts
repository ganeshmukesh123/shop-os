import type { IBarcode } from "@shopos/core";

export type IEditedCode = Pick<IBarcode, "code" | "source">;

export interface IBarcodeListProps {
  codes: readonly IEditedCode[];
  onChange: (codes: IEditedCode[]) => void;
}
