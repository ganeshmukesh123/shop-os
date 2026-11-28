import type { Item } from "@shopos/core";

export interface IDraftColorant {
  item: Item;
  /** As typed, in ml ("12.5") */
  amountText: string;
}

export interface ICustomShadeDraft {
  name: string;
  customerLabel: string;
  siteLabel: string;
  colorants: IDraftColorant[];
}
