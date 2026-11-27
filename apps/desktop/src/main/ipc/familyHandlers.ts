import {
  brandSaveInput,
  categorySaveInput,
  familiesAddVariantsInput,
  familiesCreateInput,
  familiesPreviewInput,
  familiesUpdateInput,
  variantsSetActiveInput,
  variantsSetConversionsInput,
  variantsUpdateInput,
  type IFamilyCommandMap,
} from "@shopos/core";
import { z } from "zod";
import { cmd, none } from "./command";
import type { Handlers, Services } from "./handlers";

const familyIdInput = z.object({ id: z.string().min(1) });

/** catalogue.*, families.* and variants.* of spec 002 US1 (contracts/ipc-commands.md). */
export function createFamilyHandlers(services: Services): Pick<Handlers, keyof IFamilyCommandMap> {
  const { catalogue, families } = services;
  return {
    "catalogue.categories.list": cmd<"catalogue.categories.list">(none(), () =>
      catalogue.listCategories(),
    ),
    "catalogue.categories.save": cmd<"catalogue.categories.save">(categorySaveInput, (input) =>
      catalogue.saveCategory(input),
    ),
    "catalogue.brands.list": cmd<"catalogue.brands.list">(none(), () => catalogue.listBrands()),
    "catalogue.brands.save": cmd<"catalogue.brands.save">(brandSaveInput, (input) =>
      catalogue.saveBrand(input),
    ),
    "catalogue.units.list": cmd<"catalogue.units.list">(none(), () => catalogue.listUnits()),
    "families.previewVariants": cmd<"families.previewVariants">(familiesPreviewInput, (input) =>
      families.previewVariants(input),
    ),
    "families.create": cmd<"families.create">(familiesCreateInput, (input) =>
      families.create(input),
    ),
    "families.get": cmd<"families.get">(familyIdInput, (input) => families.get(input)),
    "families.update": cmd<"families.update">(familiesUpdateInput, (input) =>
      families.update(input),
    ),
    "families.addVariants": cmd<"families.addVariants">(familiesAddVariantsInput, (input) =>
      families.addVariants(input),
    ),
    "variants.update": cmd<"variants.update">(variantsUpdateInput, (input) =>
      families.updateVariant(input),
    ),
    "variants.setActive": cmd<"variants.setActive">(variantsSetActiveInput, (input) =>
      families.setActive(input),
    ),
    "variants.setConversions": cmd<"variants.setConversions">(
      variantsSetConversionsInput,
      (input) => families.setConversions(input),
    ),
  };
}
