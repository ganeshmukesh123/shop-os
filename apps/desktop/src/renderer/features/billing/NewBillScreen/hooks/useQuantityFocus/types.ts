export interface IQuantityFocus {
  /** Remember a line whose quantity field should take the focus once it is on screen. */
  rememberLineToFocus: (lineKey: string) => void;
  /** Give to each line's quantity field, so the hook can find it by its line key. */
  onQtyFieldRef: (lineKey: string, quantityField: HTMLInputElement | null) => void;
}
