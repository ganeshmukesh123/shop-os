import type { IItemSearchRow, ISearchEntry, ISearchResult } from "@shopos/core";
import type { Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { SearchSourceRepository } from "../../repositories/SearchSourceRepository";
import { SearchIndex } from "./SearchIndex";
import { toSearchRows } from "./searchRows";

/**
 * Search over items (spec 002 research D4): an in-memory index built when the app starts and
 * kept up to date after each write that changes what search sees. The writer calls the refresh:
 * refreshVariant after a create, rename, deactivate or reactivate; refreshAfterMerge after a merge
 * or its reversal; refreshSalesCounts after bills change the 90-day counts.
 */
export class SearchService {
  private readonly index = new SearchIndex();
  private readonly source: SearchSourceRepository;

  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {
    this.source = new SearchSourceRepository(databaseHandle, ctx);
    this.index.replaceAll(this.source.entries(), this.source.billCounts());
  }

  search(query: string): ISearchResult[] {
    return this.index.query(query);
  }

  /** items.search: the best `limit` results as rows the bill screen can show (T038). */
  searchRows(query: string, limit: number): { results: IItemSearchRow[] } {
    const ranked = this.index.query(query).slice(0, limit);
    return { results: toSearchRows(this.databaseHandle, this.ctx, ranked) };
  }

  /** Re-read the variant's family: its variant count, names and codes may all have changed. */
  refreshVariant(variantId: string): void {
    this.refreshFamiliesOf([variantId]);
  }

  /** Both families change: the merged variant leaves the index and its codes go to the survivor. */
  refreshAfterMerge(survivorId: string, mergedId: string): void {
    this.refreshFamiliesOf([survivorId, mergedId]);
  }

  refreshSalesCounts(): void {
    this.index.setBillCounts(this.source.billCounts());
  }

  /** The entries as read from the database, for tests and diagnostics. */
  entries(): ISearchEntry[] {
    return this.index.entries();
  }

  get size(): number {
    return this.index.size;
  }

  private refreshFamiliesOf(variantIds: readonly string[]): void {
    const familyIds = [
      ...new Set(
        variantIds
          .map((variantId) => this.source.familyOf(variantId))
          .filter((familyId): familyId is string => familyId !== null),
      ),
    ];
    this.index.replaceFamilies(familyIds, this.source.entries(familyIds));
  }
}
