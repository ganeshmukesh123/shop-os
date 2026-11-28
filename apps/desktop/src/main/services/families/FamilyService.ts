import {
  CoreError,
  familiesAddVariantsInput,
  familiesCreateInput,
  familiesPreviewInput,
  familiesUpdateInput,
  buildVariantGrid,
  generateVariantCombinations,
  variantsSetActiveInput,
  variantsSetConversionsInput,
  variantsUpdateInput,
  type FamiliesAddVariantsInput,
  type FamiliesCreateInput,
  type FamiliesPreviewInput,
  type FamiliesUpdateInput,
  type IFamily,
  type IFamilyDetail,
  type IFamilyGrid,
  type IUnitConversion,
  type IVariant,
  type IVariantCombinationPreview,
  type VariantsSetActiveInput,
  type VariantsSetConversionsInput,
  type VariantsUpdateInput,
} from "@shopos/core";
import type { DB } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { CatalogueRepository } from "../../repositories/CatalogueRepository";
import { BarcodeRepository } from "../../repositories/BarcodeRepository";
import { ConversionRepository, FamilyRepository } from "../../repositories/FamilyRepository";
import { SearchNameRepository } from "../../repositories/SearchNameRepository";
import { ItemRepository } from "../../repositories/ItemRepository";
import type { SearchService } from "../search";
import { insertVariants } from "./familyWrites";
import { toVariantPatch } from "./variantPatch";

/** The search index's refresh, so a new or renamed variant is found at once (research D4). */
export type ISearchRefresher = Pick<SearchService, "refreshVariant">;

const notFound = (what: string) => new CoreError("NOT_FOUND", `That ${what} is not here any more`);

/**
 * The families.* and variants.* commands (spec 002 contracts, T033). Each write runs in one
 * transaction: a family, its variants and their opening movements commit together or not at all.
 * After a write that changes what search sees, the index re-reads the family.
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
      this.assertFreeName(families, input.family.name);
      const family = families.insertFamily({
        ...input.family,
        categoryId: input.family.categoryId ?? null,
        brandId: input.family.brandId ?? null,
      });
      insertVariants(transaction, this.ctx, family, input.variants);
      return { family, variants: families.listVariants(family.id) };
    });
    this.search?.refreshVariant(created.variants[0]!.id);
    return { ...created, duplicates: [] };
  }

  get(raw: { id: string }): IFamilyDetail {
    const families = new FamilyRepository(this.db, this.ctx);
    const family = families.getFamily(raw.id);
    if (!family) throw notFound("family");
    const variants = families.listVariants(family.id);
    const conversions = new ConversionRepository(this.db, this.ctx).listFor(
      variants.map((variant) => variant.id),
    );
    const variantIds = variants.map((variant) => variant.id);
    const codes = new BarcodeRepository(this.db, this.ctx);
    const barcodes = variantIds.flatMap((variantId) => codes.listFor(variantId));
    const searchNames = new SearchNameRepository(this.db, this.ctx).listFor(variantIds);
    return { family, variants, conversions, barcodes, searchNames };
  }

  /** families.grid (T038): the family's live variants laid out by its axes, each billable. */
  grid(raw: { familyId: string }): IFamilyGrid {
    const families = new FamilyRepository(this.db, this.ctx);
    const family = families.getFamily(raw.familyId);
    if (!family) throw notFound("family");
    const live = families
      .listVariants(family.id)
      .filter((variant) => variant.mergedIntoId === null);
    const items = new ItemRepository(this.db, this.ctx);
    const grid = buildVariantGrid(
      family.axisKeys,
      live.map((variant) => ({
        variantId: variant.id,
        axes: variant.axes,
        stockMilli: variant.stockMilli,
        pricePaise: variant.sellingPricePaise,
        isActive: variant.isActive,
      })),
    );
    return {
      axisKeys: family.axisKeys,
      tabs: grid.tabs,
      items: live.map((variant) => items.get(variant.id)!),
    };
  }

  update(raw: FamiliesUpdateInput): { family: IFamily } {
    const { id, ...patch } = familiesUpdateInput.parse(raw);
    const families = new FamilyRepository(this.db, this.ctx);
    if (patch.name) this.assertFreeName(families, patch.name, id);
    const family = families.updateFamily(id, patch);
    if (!family) throw notFound("family");
    this.refreshFamily(families, family.id);
    return { family };
  }

  addVariants(raw: FamiliesAddVariantsInput): { variants: IVariant[] } {
    const input = familiesAddVariantsInput.parse(raw);
    const variants = this.db.transaction((transaction) => {
      const families = new FamilyRepository(transaction, this.ctx);
      const family = families.getFamily(input.familyId);
      if (!family) throw notFound("family");
      const insertedIds = insertVariants(transaction, this.ctx, family, input.variants);
      return insertedIds.map((variantId) => families.getVariant(variantId)!);
    });
    this.search?.refreshVariant(variants[0]!.id);
    return { variants };
  }

  updateVariant(raw: VariantsUpdateInput): { variant: IVariant } {
    const input = variantsUpdateInput.parse(raw);
    const families = new FamilyRepository(this.db, this.ctx);
    const current = families.getVariant(input.id);
    if (!current) throw notFound("item");
    const family = families.getFamily(current.familyId)!;
    const variant = families.updateVariant(input.id, toVariantPatch(family.kind, current, input))!;
    this.search?.refreshVariant(variant.id);
    return { variant };
  }

  /** Deactivating keeps the row and every bill that names it (constitution I); no delete exists. */
  setActive(raw: VariantsSetActiveInput): { variant: IVariant } {
    const input = variantsSetActiveInput.parse(raw);
    const families = new FamilyRepository(this.db, this.ctx);
    const current = families.getVariant(input.id);
    if (!current) throw notFound("item");
    if (current.mergedIntoId !== null && input.isActive) {
      throw new CoreError("MERGED", "This item was merged into another; reverse the merge instead");
    }
    const variant = families.setVariantActive(input.id, input.isActive)!;
    this.search?.refreshVariant(variant.id);
    return { variant };
  }

  /** Replace a variant's alternate units: never its base unit, only units the shop has. */
  setConversions(raw: VariantsSetConversionsInput): { conversions: IUnitConversion[] } {
    const input = variantsSetConversionsInput.parse(raw);
    return this.db.transaction((transaction) => {
      const variant = new FamilyRepository(transaction, this.ctx).getVariant(input.variantId);
      if (!variant) throw notFound("item");
      const catalogue = new CatalogueRepository(transaction, this.ctx);
      input.conversions.forEach(({ uomCode }) => {
        if (uomCode === variant.baseUom) {
          throw new CoreError("BASE_UNIT_LISTED", `${uomCode} is already the item's own unit`);
        }
        if (!catalogue.hasUnit(uomCode)) {
          throw new CoreError("UNKNOWN_UNIT", `${uomCode} is not one of the shop's units`);
        }
      });
      const conversions = new ConversionRepository(transaction, this.ctx);
      conversions.replace(variant.id, input.conversions);
      return { conversions: conversions.listFor([variant.id]) };
    });
  }

  private assertFreeName(families: FamilyRepository, name: string, excludeId?: string): void {
    if (families.hasFamilyNamed(name, excludeId)) {
      throw new CoreError("DUPLICATE_NAME", `A family called ${name} already exists`);
    }
  }

  private refreshFamily(families: FamilyRepository, familyId: string): void {
    const [firstVariant] = families.listVariants(familyId);
    if (firstVariant) this.search?.refreshVariant(firstVariant.id);
  }
}
