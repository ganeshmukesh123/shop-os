import type { Item } from "@shopos/core";

export interface IBillSearchBoxProps {
  query: string;
  matches: Item[];
  highlightedIndex: number;
  onQueryChange: (nextQuery: string) => void;
  onHighlightChange: (nextIndex: number) => void;
  /** Called with the item to add: from Enter on the highlighted match, or a click. */
  onChoose: (chosenItem: Item) => void;
}
