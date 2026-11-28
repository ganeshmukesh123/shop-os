import type {
  BrandSaveInput,
  CategorySaveInput,
  FamiliesAddVariantsInput,
  FamiliesCreateInput,
  FamiliesPreviewInput,
  FamiliesUpdateInput,
  VariantsSetActiveInput,
  VariantsSetConversionsInput,
  VariantsUpdateInput,
} from "./familyCommands";
import type {
  IBrand,
  ICategory,
  IFamily,
  IFamilyDetail,
  IUnit,
  IUnitConversion,
  IVariant,
  IVariantCombinationPreview,
} from "./familyTypes";
import type {
  FamiliesGridInput,
  IFamilyGrid,
  IItemSearchRow,
  ItemsSearchInput,
} from "./searchCommands";

type NoInput = Record<string, never>;

/** The US1 commands of spec 002 (contracts/ipc-commands.md, first table): name -> [input, data]. */
export interface IFamilyCommandMap {
  "catalogue.categories.list": [NoInput, { categories: ICategory[] }];
  "catalogue.categories.save": [CategorySaveInput, { category: ICategory }];
  "catalogue.brands.list": [NoInput, { brands: IBrand[] }];
  "catalogue.brands.save": [BrandSaveInput, { brand: IBrand }];
  "catalogue.units.list": [NoInput, { units: IUnit[] }];
  "families.previewVariants": [
    FamiliesPreviewInput,
    { combinations: IVariantCombinationPreview[] },
  ];
  "families.create": [
    FamiliesCreateInput,
    { family: IFamily; variants: IVariant[]; duplicates: [] },
  ];
  "families.get": [{ id: string }, IFamilyDetail];
  "families.update": [FamiliesUpdateInput, { family: IFamily }];
  "families.addVariants": [FamiliesAddVariantsInput, { variants: IVariant[] }];
  "variants.update": [VariantsUpdateInput, { variant: IVariant }];
  "variants.setActive": [VariantsSetActiveInput, { variant: IVariant }];
  "variants.setConversions": [VariantsSetConversionsInput, { conversions: IUnitConversion[] }];
  /** The bill search over the in-memory index (T038) and a family's grid */
  "items.search": [ItemsSearchInput, { results: IItemSearchRow[] }];
  "families.grid": [FamiliesGridInput, IFamilyGrid];
}

export const FAMILY_COMMAND_NAMES = [
  "catalogue.categories.list",
  "catalogue.categories.save",
  "catalogue.brands.list",
  "catalogue.brands.save",
  "catalogue.units.list",
  "families.previewVariants",
  "families.create",
  "families.get",
  "families.update",
  "families.addVariants",
  "variants.update",
  "variants.setActive",
  "variants.setConversions",
  "items.search",
  "families.grid",
] as const satisfies readonly (keyof IFamilyCommandMap)[];
