import type { DraftLine, DraftLineResult } from "@shopos/core";

export interface IBillLinesTableProps {
  lines: DraftLine[];
  /** One result per line, in the same order: the amount, or what is wrong with the line. */
  results: DraftLineResult[];
  onLineChange: (lineKey: string, patch: Partial<DraftLine>) => void;
  onLineRemove: (lineKey: string) => void;
  /** Enter in a quantity field sends the cursor back to the search box. */
  onEnterQty: () => void;
  /** Lets the screen focus a line's quantity field after an item is added. */
  onQtyFieldRef: (lineKey: string, quantityField: HTMLInputElement | null) => void;
}
