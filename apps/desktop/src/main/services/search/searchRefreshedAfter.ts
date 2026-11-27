import type { SearchService } from "./SearchService";

/**
 * After an item write has committed, re-read that item's family into the search index (create,
 * rename, deactivate, reactivate) and pass the write's result through unchanged. A refused write
 * throws before this runs, so the index never changes for it.
 */
export function searchRefreshedAfter<TResult extends { item: { id: string } }>(
  search: SearchService,
  result: TResult,
): TResult {
  search.refreshVariant(result.item.id);
  return result;
}
