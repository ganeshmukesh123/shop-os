import type { IItemSearchRow } from "@shopos/core";

export interface IItemSearch {
  query: string;
  /** Variants and families, best first (items.search) */
  matches: IItemSearchRow[];
  /** Which match Enter would add; moves with the arrow keys and the mouse. */
  highlightedIndex: number;
  setQuery: (nextQuery: string) => void;
  setHighlightedIndex: (nextIndex: number) => void;
  /** Empties the box and the matches, for after an item has been added. */
  clearSearch: () => void;
}
