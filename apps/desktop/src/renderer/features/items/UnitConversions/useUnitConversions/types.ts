import type { IUnitConversion } from "@shopos/core";

/** One alternate unit as typed: how much of the base unit one of it holds ("90" metre a roll). */
export interface IConversionRow {
  key: string;
  uomCode: string;
  holdsText: string;
}

export interface IUseUnitConversionsOptions {
  variantId: string;
  conversions: readonly IUnitConversion[];
}
