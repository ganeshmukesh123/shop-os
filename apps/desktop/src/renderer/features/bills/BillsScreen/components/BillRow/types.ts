import type { Bill } from "@shopos/core";

export interface IBillRowProps {
  bill: Bill;
  /** Called with the bill's id when its number is chosen. */
  onOpen: (billId: string) => void;
}
