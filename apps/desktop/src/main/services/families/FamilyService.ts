import {
  CoreError,
  familiesCreateInput,
  familiesPreviewInput,
  generateVariantCombinations,
  variantsSetActiveInput,
  type FamiliesCreateInput,
  type FamiliesPreviewInput,
  type IFamily,
  type IVariant,
  type IVariantCombinationPreview,
  type VariantsSetActiveInput,
} from "@shopos/core";
import type { DB, Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { CatalogueRepository } from "../../repositories/CatalogueRepository";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { ItemRepository } from "../../repositories/ItemRepository";
import { StockRepository } from "../../repositories/StockRepository";
import { CatalogueService } from "../catalogue";
import type { SearchService } from "../search";
import { toVariantRows, type IVariantNaming } from "./variantRows";

/** The search index's refresh, so a new or renamed variant is found at once (research D4). */
export type ISearchRefresher = Pick<SearchService, "refreshVariant">;

/**
 * The families.* and variants.* commands (spec 002 contracts, T033). Writes run in one
 * transaction: the family, its variants and their opening movements commit together or not at all.
 */
export class FamilyService {
  constructor(
    private readonly db: DB,
    private readonly ctx: Ctx,
    private readonly search?: ISearchRefresher,
  ) {}

  previewVariants(raw: FamiliesPreviewInput): { combinations: IVariantCombinationPreview[] } {
    const input = familiesPreviewInput.parse(raw);
    const combinations = generateVariantCombinations(input.axisKeys, input.axisValues);
    return {
      combinations: combinations.map(({ axes, axisSignature }) => ({
        axes,
        axisSignature,
        displayName: Object.values(axes).join(" "),
      })),
    };
  }

  create(raw: FamiliesCreateInput): { family: IFamily; variants: IVariant[]; duplicates: [] } {
    const input = familiesCreateInput.parse(raw);
    const created = this.db.transaction((transaction) => {
      const families = new FamilyRepository(transaction, this.ctx);
      if (families.hasFamilyNamed(input.family.name)) {
        throw new CoreError(
          "DUPLICATE_NAME",
          `A family called ${input.family.name} already exists`,
        );
      }
      this.assertUnits(
        transaction,
        input.variants.map((variant) => variant.baseUom),
      );
      const naming = this.namingFor(input.family);
      const rows = toVariantRows(input.family, naming, input.variants);
      const family = families.insertFamily({
        ...input.family,
        categoryId: input.family.categoryId ?? null,
        brandId: input.family.brandId ?? null,
      });
      const variants = rows.map((variantRow) => families.insertVariant(family.id, variantRow));
      this.writeOpeningStock(
        transaction,
        variants,
        input.variants.map((variant) => variant.openingQtyMilli),
      );
      return { family, variants: families.listVariants(family.id) };
    });
    this.search?.refreshVariant(created.variants[0]!.id);
    return { ...created, duplicates: [] };
  }

  /** Deactivating keeps the row and every bill that names it (constitution I); no delete exists. */
  setActive(raw: VariantsSetActiveInput): { variant: IVariant } {
    const input = variantsSetActiveInput.parse(raw);
    const families = new FamilyRepository(this.db, this.ctx);
    const current = families.getVariant(input.id);
    if (!current) throw new CoreError("NOT_FOUND", "That item is not here any more");
    if (current.mergedIntoId !== null && input.isActive) {
      throw new CoreError("MERGED", "This item was merged into another; reverse the merge instead");
    }
    const variant = families.setVariantActive(input.id, input.isActive)!;
    this.search?.refreshVariant(variant.id);
    return { variant };
  }

  /** The category's inherited title template and the brand's name, for naming variants. */
  private namingFor(family: FamiliesCreateInput["family"]): IVariantNaming {
    const { categories } = new CatalogueService(this.db, this.ctx).listCategories();
    const { brands } = new CatalogueService(this.db, this.ctx).listBrands();
    const category = categories.find((candidate) => candidate.id === family.categoryId);
    const brand = brands.find((candidate) => candidate.id === family.brandId);
    return {
      familyName: family.name,
      brandName: brand?.name ?? null,
      titleTemplate: category?.resolved.titleTemplate ?? null,
    };
  }

  private assertUnits(transaction: Handle, unitCodes: string[]): void {
    const catalogue = new CatalogueRepository(transaction, this.ctx);
    const unknown = unitCodes.find((code) => !catalogue.hasUnit(code));
    if (unknown !== undefined) {
      throw new CoreError("INVALID_FIELD", `${unknown} is not one of the shop's units`);
    }
  }

  /** One opening movement per variant that starts with stock; none for zero (T028). */
  private writeOpeningStock(
    transaction: Handle,
    variants: readonly IVariant[],
    openingQuantities: readonly number[],
  ): void {
    const stock = new StockRepository(transaction, this.ctx);
    const items = new ItemRepository(transaction, this.ctx);
    variants.forEach((variant, variantIndex) => {
      const openingQtyMilli = openingQuantities[variantIndex] ?? 0;
      if (openingQtyMilli === 0) return;
      stock.append({ itemId: variant.id, quantityMilli: openingQtyMilli, reason: "opening" });
      items.addStockDelta(variant.id, openingQtyMilli);
    });
  }
}
