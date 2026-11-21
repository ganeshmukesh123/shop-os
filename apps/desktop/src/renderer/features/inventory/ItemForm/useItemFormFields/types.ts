export interface IItemFormFields {
  name: string;
  /** Which entry of the unit list is chosen: a unit, or the "Custom…" option. */
  unitChoice: string;
  customUnit: string;
  priceText: string;
  openingText: string;
  /** The unit as it will be saved: the chosen one, or the trimmed custom name. */
  unit: string;
  allowsDecimal: boolean;
  isEditing: boolean;
  setName: (nextName: string) => void;
  /** Choosing another unit forgets any decimal choice, so the unit's own default applies. */
  chooseUnit: (selectedUnit: string) => void;
  setCustomUnit: (nextCustomUnit: string) => void;
  setAllowsDecimal: (nextAllowsDecimal: boolean) => void;
  setPriceText: (nextPriceText: string) => void;
  setOpeningText: (nextOpeningText: string) => void;
}
