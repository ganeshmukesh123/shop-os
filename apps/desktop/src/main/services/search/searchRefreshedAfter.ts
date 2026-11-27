import type { SearchService } from "./SearchService";

/**
 * After an item write has committed, re-read that item's family into the search index (create,
 * rename, deactivate, reactivate) and pass the write's result through unchanged. A refused write
 * throws before this runs, so the index never changes for it. If refresh fails, the index
 * can remain stale until the next app start rebuilds it from the saved data.
 */
export function searchRefreshedAfter<TResult extends { item: { id: string } }>(
  result: TResult,
  search: SearchService,
): TResult {
  try {
    search.refreshVariant(result.item.id);
  } catch {
    console.warn(
      "Search index refresh failed after saving an item; restart the app to rebuild it.",
    );
  }
  return result;
}
