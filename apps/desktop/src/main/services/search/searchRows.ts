import type { IItemSearchRow, ISearchResult, Item } from "@shopos/core";
import type { Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { ItemRepository } from "../../repositories/ItemRepository";

/**
 * The bill search's rows (contracts items.search) for ranked results: a variant as its Item, a
 * family of several as one row with the stock of all its active variants and its lowest price.
 */
export function toSearchRows(
  handle: Handle,
  ctx: Ctx,
  results: readonly ISearchResult[],
): IItemSearchRow[] {
  const items = new ItemRepository(handle, ctx);
  const families = new FamilyRepository(handle, ctx);
  return results.flatMap((result): IItemSearchRow[] => {
    if (result.kind === "variant") {
      const item = items.get(result.id);
      return item ? [variantRow(result, item)] : [];
    }
    const family = families.getFamily(result.id);
    const live = families
      .listVariants(result.id)
      .filter((variant) => variant.isActive && variant.mergedIntoId === null);
    if (!family || live.length === 0) return [];
    return [
      {
        kind: "family",
        id: family.id,
        displayName: family.name,
        matchedBy: result.tier,
        stockMilli: live.reduce((total, variant) => total + variant.stockMilli, 0),
        pricePaise: Math.min(...live.map((variant) => variant.sellingPricePaise)),
        item: null,
      },
    ];
  });
}

const variantRow = (result: ISearchResult, item: Item): IItemSearchRow => ({
  kind: "variant",
  id: item.id,
  displayName: item.name,
  matchedBy: result.tier,
  stockMilli: item.stockMilli,
  pricePaise: item.pricePaise,
  item,
});
