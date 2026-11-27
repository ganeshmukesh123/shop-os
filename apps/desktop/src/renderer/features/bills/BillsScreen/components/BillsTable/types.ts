import type { Bill } from "@shopos/core";

export interface IBillsTableProps {
  bills: Bill[];
  /** Called with the id of the bill whose number was chosen. */
  onOpen: (billId: string) => void;
}
