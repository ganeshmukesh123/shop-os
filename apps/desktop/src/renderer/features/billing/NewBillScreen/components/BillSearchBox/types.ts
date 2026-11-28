import type { IItemSearchRow } from "@shopos/core";

export interface IBillSearchBoxProps {
  query: string;
  matches: IItemSearchRow[];
  highlightedIndex: number;
  onQueryChange: (nextQuery: string) => void;
  onHighlightChange: (nextIndex: number) => void;
  /** Called with the chosen row (a variant to add, or a family to open): Enter or a click. */
  onChoose: (chosenRow: IItemSearchRow) => void;
}
