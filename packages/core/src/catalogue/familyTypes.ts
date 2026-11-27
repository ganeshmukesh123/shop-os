import type { ICategoryDefaults } from "./categoryDefaults";
import type { FamilyKind, PetroleumClass } from "./variantDraft";

/** What the catalogue.*, families.* and variants.* commands return (spec 002 T031). */
export interface ICategory {
  id: string;
  parentId: string | null;
  name: string;
  /** The category's own defaults, empty where it inherits */
  defaultHsn: string | null;
  defaultBaseUom: string | null;
  titleTemplate: string | null;
  /** What a new family in this category gets, after inheriting from its ancestors */
  resolved: ICategoryDefaults;
}

export interface IBrand {
  id: string;
  name: string;
}

export interface IUnit {
  code: string;
  label: string;
  dimension: "count" | "length" | "mass" | "volume";
  allowDecimal: boolean;
}

export interface IFamily {
  id: string;
  name: string;
  kind: FamilyKind;
  categoryId: string | null;
  brandId: string | null;
  spec: Record<string, string>;
  axisKeys: string[];
}

export interface IVariant {
  id: string;
  familyId: string;
  itemCode: string;
  displayName: string;
  axes: Record<string, string>;
  axisSignature: string;
  baseUom: string;
  allowDecimal: boolean;
  sellingPricePaise: number;
  purchasePricePaise: number | null;
  reorderLevelMilli: number | null;
  stockMilli: number;
  isActive: boolean;
  locationTag: string | null;
  petroleumClass: PetroleumClass | null;
  declaredQtyMilli: number | null;
  declaredUom: string | null;
  tradeLabel: string | null;
  sealedPackOnly: boolean;
  warrantyMonths: number | null;
  isSerialTracked: boolean;
  mergedIntoId: string | null;
}

/** One alternate unit: factorMilli thousandths of the base unit in one of it (roll = 90000). */
export interface IUnitConversion {
  variantId: string;
  uomCode: string;
  factorMilli: number;
}

export interface IVariantCombinationPreview {
  axes: Record<string, string>;
  axisSignature: string;
  displayName: string;
}

export interface IFamilyDetail {
  family: IFamily;
  variants: IVariant[];
  conversions: IUnitConversion[];
}
