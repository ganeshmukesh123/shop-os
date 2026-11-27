import {
  CoreError,
  brandSaveInput,
  categorySaveInput,
  type BrandSaveInput,
  type CategorySaveInput,
  type IBrand,
  type ICategory,
  type IUnit,
} from "@shopos/core";
import type { Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { CatalogueRepository, type CategoryRow } from "../../repositories/CatalogueRepository";
import { MAX_CATEGORY_DEPTH, inTreeOrder, pathTo, toCategory } from "./categoryTree";

/** The catalogue.* commands (spec 002 contracts, T033): categories, brands and units. */
export class CatalogueService {
  private readonly repository: CatalogueRepository;

  constructor(databaseHandle: Handle, ctx: Ctx) {
    this.repository = new CatalogueRepository(databaseHandle, ctx);
  }

  listUnits(): { units: IUnit[] } {
    return { units: this.repository.listUnits() };
  }

  listCategories(): { categories: ICategory[] } {
    return { categories: inTreeOrder(this.repository.listCategoryRows()) };
  }

  saveCategory(raw: CategorySaveInput): { category: ICategory } {
    const input = categorySaveInput.parse(raw);
    const rows = this.repository.listCategoryRows();
    const parentId = input.parentId ?? null;
    this.assertPlacement(rows, input.id, parentId);
    if (input.defaultBaseUom && !this.repository.hasUnit(input.defaultBaseUom)) {
      throw new CoreError(
        "INVALID_FIELD",
        `${input.defaultBaseUom} is not one of the shop's units`,
      );
    }
    const fields = {
      parentId,
      name: input.name,
      defaultHsn: input.defaultHsn ?? null,
      defaultBaseUom: input.defaultBaseUom ?? null,
      titleTemplate: input.titleTemplate?.trim() || null,
    };
    const savedRow = input.id
      ? this.repository.updateCategory(input.id, fields)
      : this.repository.insertCategory(fields);
    if (!savedRow) throw new CoreError("NOT_FOUND", "That category is not here any more");
    return { category: toCategory(this.repository.listCategoryRows(), savedRow) };
  }

  listBrands(): { brands: IBrand[] } {
    return { brands: this.repository.listBrands() };
  }

  saveBrand(raw: BrandSaveInput): { brand: IBrand } {
    const input = brandSaveInput.parse(raw);
    const savedBrand = input.id
      ? this.repository.updateBrand(input.id, input.name)
      : this.repository.insertBrand(input.name);
    if (!savedBrand) throw new CoreError("NOT_FOUND", "That brand is not here any more");
    return { brand: savedBrand };
  }

  /** The parent exists, the category is not put under itself, and the tree stays 4 deep. */
  private assertPlacement(
    rows: readonly CategoryRow[],
    categoryId: string | undefined,
    parentId: string | null,
  ): void {
    if (parentId === null) return;
    const parentPath = pathTo(rows, parentId);
    if (parentPath.length === 0)
      throw new CoreError("NOT_FOUND", "The parent category is not here");
    if (categoryId && parentPath.some((categoryRow) => categoryRow.id === categoryId)) {
      throw new CoreError("INVALID_FIELD", "A category cannot go under itself");
    }
    if (parentPath.length >= MAX_CATEGORY_DEPTH) {
      throw new CoreError("TOO_DEEP", `Categories go at most ${MAX_CATEGORY_DEPTH} levels deep`);
    }
  }
}
