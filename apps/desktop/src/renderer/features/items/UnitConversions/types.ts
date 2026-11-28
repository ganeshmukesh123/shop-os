import type { IUnit, IUnitConversion } from "@shopos/core";
import type { IConversionRow } from "./useUnitConversions";

export interface IUnitConversionsProps {
  variantId: string;
  /** The variant's own unit, never offered as an alternate */
  baseUnit: string;
  units: readonly IUnit[];
  conversions: readonly IUnitConversion[];
}

export interface IConversionRowFieldsProps {
  row: IConversionRow;
  baseUnit: string;
  unitOptions: readonly IUnit[];
  onUnit: (uomCode: string) => void;
  onHolds: (holdsText: string) => void;
  onRemove: () => void;
}
