import type { IPreviewRow } from "../FamilyForm/useFamilyForm";

export interface IVariantPreviewProps {
  rows: readonly IPreviewRow[];
  /** The unit the opening stock is counted in, shown in each row's label */
  unit: string;
  onToggle: (axisSignature: string) => void;
  onPrice: (axisSignature: string, priceText: string) => void;
  onOpening: (axisSignature: string, openingText: string) => void;
}
