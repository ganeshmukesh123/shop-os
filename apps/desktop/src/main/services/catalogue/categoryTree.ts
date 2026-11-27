import { resolveCategoryDefaults, type ICategory } from "@shopos/core";
import type { CategoryRow } from "../../repositories/CatalogueRepository";

/** A category may sit at most 4 levels deep (data-model.md "category"). */
export const MAX_CATEGORY_DEPTH = 4;

/** The chain from the top category down to `categoryId` (empty when it is unknown). */
export function pathTo(rows: readonly CategoryRow[], categoryId: string | null): CategoryRow[] {
  const byId = new Map(rows.map((categoryRow) => [categoryRow.id, categoryRow]));
  const path: CategoryRow[] = [];
  let current = categoryId === null ? undefined : byId.get(categoryId);
  while (current && !path.includes(current)) {
    path.unshift(current);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return path;
}

export function toCategory(rows: readonly CategoryRow[], categoryRow: CategoryRow): ICategory {
  return {
    id: categoryRow.id,
    parentId: categoryRow.parentId,
    name: categoryRow.name,
    defaultHsn: categoryRow.defaultHsn,
    defaultBaseUom: categoryRow.defaultBaseUom,
    titleTemplate: categoryRow.titleTemplate,
    resolved: resolveCategoryDefaults(pathTo(rows, categoryRow.id)),
  };
}

/** Depth-first: each category, then its children; siblings keep the rows' (name) order. */
export function inTreeOrder(rows: readonly CategoryRow[]): ICategory[] {
  const childrenOf = (parentId: string | null): ICategory[] =>
    rows
      .filter((categoryRow) => categoryRow.parentId === parentId)
      .flatMap((categoryRow) => [toCategory(rows, categoryRow), ...childrenOf(categoryRow.id)]);
  return childrenOf(null);
}
