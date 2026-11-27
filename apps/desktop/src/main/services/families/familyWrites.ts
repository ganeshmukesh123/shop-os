import { CoreError, type IVariant, type NewVariantInput } from "@shopos/core";
import type { Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { CatalogueRepository } from "../../repositories/CatalogueRepository";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { ItemRepository } from "../../repositories/ItemRepository";
import { StockRepository } from "../../repositories/StockRepository";
import { inTreeOrder } from "../catalogue/categoryTree";
import { toVariantRows, type IFamilyShape, type IVariantNaming } from "./variantRows";

/** Shared by families.create and families.addVariants; each runs inside the caller's transaction. */
export interface IFamilyForNaming extends IFamilyShape {
  name: string;
  categoryId?: string | null;
  brandId?: string | null;
}

/** The category's inherited title template and the brand's name, for naming variants. */
export function namingFor(handle: Handle, ctx: Ctx, family: IFamilyForNaming): IVariantNaming {
  const catalogue = new CatalogueRepository(handle, ctx);
  const category = inTreeOrder(catalogue.listCategoryRows()).find(
    (candidate) => candidate.id === family.categoryId,
  );
  const brand = catalogue.listBrands().find((candidate) => candidate.id === family.brandId);
  return {
    familyName: family.name,
    brandName: brand?.name ?? null,
    titleTemplate: category?.resolved.titleTemplate ?? null,
  };
}

function assertUnits(handle: Handle, ctx: Ctx, unitCodes: readonly string[]): void {
  const catalogue = new CatalogueRepository(handle, ctx);
  const unknown = unitCodes.find((code) => !catalogue.hasUnit(code));
  if (unknown !== undefined) {
    throw new CoreError("INVALID_FIELD", `${unknown} is not one of the shop's units`);
  }
}

/** One opening movement per variant that starts with stock; none for zero (T028). */
function writeOpeningStock(
  handle: Handle,
  ctx: Ctx,
  variants: readonly IVariant[],
  openingQuantities: readonly number[],
): void {
  const stock = new StockRepository(handle, ctx);
  const items = new ItemRepository(handle, ctx);
  variants.forEach((variant, variantIndex) => {
    const openingQtyMilli = openingQuantities[variantIndex] ?? 0;
    if (openingQtyMilli === 0) return;
    stock.append({ itemId: variant.id, quantityMilli: openingQtyMilli, reason: "opening" });
    items.addStockDelta(variant.id, openingQtyMilli);
  });
}

/** Check, insert and stock the new variants of `familyId`; refuse the lot if one fails. Returns their ids. */
export function insertVariants(
  handle: Handle,
  ctx: Ctx,
  family: IFamilyForNaming & { id: string },
  newVariants: readonly NewVariantInput[],
): string[] {
  const families = new FamilyRepository(handle, ctx);
  assertUnits(
    handle,
    ctx,
    newVariants.map((variant) => variant.baseUom),
  );
  const existingSignatures = families
    .listVariants(family.id)
    .map((variant) => variant.axisSignature);
  const rows = toVariantRows(
    family,
    namingFor(handle, ctx, family),
    newVariants,
    existingSignatures,
  );
  const inserted = rows.map((variantRow) => families.insertVariant(family.id, variantRow));
  writeOpeningStock(
    handle,
    ctx,
    inserted,
    newVariants.map((variant) => variant.openingQtyMilli),
  );
  return inserted.map((variant) => variant.id);
}
