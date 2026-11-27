import {
  prepareSearchEntry,
  rankPreparedMatches,
  type IPreparedSearchEntry,
  type ISearchEntry,
  type ISearchResult,
} from "@shopos/core";

/**
 * The in-memory search index (spec 002 research D4). It holds every searchable variant with its
 * names already normalised (prepareSearchEntry), so a query only normalises what was typed. The
 * index is replaced a family at a time, because a family's variant count decides how it shows.
 */
export class SearchIndex {
  private readonly entriesByVariant = new Map<string, IPreparedSearchEntry>();
  private readonly originalByVariant = new Map<string, ISearchEntry>();
  private billCounts: ReadonlyMap<string, number> = new Map();

  /** Replace everything (the build at start). */
  replaceAll(entries: readonly ISearchEntry[], billCounts: ReadonlyMap<string, number>): void {
    this.entriesByVariant.clear();
    this.originalByVariant.clear();
    entries.forEach((entry) => this.put(entry));
    this.billCounts = billCounts;
  }

  /** Replace the given families with `entries` (which may hold none of a family: it went away). */
  replaceFamilies(familyIds: readonly string[], entries: readonly ISearchEntry[]): void {
    const families = new Set(familyIds);
    [...this.entriesByVariant.values()]
      .filter((entry) => families.has(entry.familyId))
      .forEach((entry) => {
        this.entriesByVariant.delete(entry.variantId);
        this.originalByVariant.delete(entry.variantId);
      });
    entries.forEach((entry) => this.put(entry));
  }

  setBillCounts(billCounts: ReadonlyMap<string, number>): void {
    this.billCounts = billCounts;
  }

  query(text: string): ISearchResult[] {
    return rankPreparedMatches(text, [...this.entriesByVariant.values()], this.billCounts);
  }

  /** The entries as built, before normalising (for tests and diagnostics). */
  entries(): ISearchEntry[] {
    return [...this.originalByVariant.values()];
  }

  get size(): number {
    return this.entriesByVariant.size;
  }

  private put(entry: ISearchEntry): void {
    this.entriesByVariant.set(entry.variantId, prepareSearchEntry(entry));
    this.originalByVariant.set(entry.variantId, entry);
  }
}
