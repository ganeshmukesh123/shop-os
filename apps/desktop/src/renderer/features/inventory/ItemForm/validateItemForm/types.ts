export interface IItemFormValues {
  name: string;
  /** The unit as it will be saved: the chosen one, or the custom name typed in. */
  unit: string;
  priceText: string;
  openingText: string;
  allowsDecimal: boolean;
  isEditing: boolean;
}

export interface IItemFormValidation {
  /** Plain sentences, in the order the fields appear; empty when the form can be saved. */
  errors: string[];
  /** The price in paise, or null when it could not be read. */
  pricePaise: number | null;
  /** The opening stock in thousandths of the unit; 0 when none was given or when editing. */
  openingQtyMilli: number;
}
