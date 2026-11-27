import type { Bill, IRecordedNumberGap } from "@shopos/core";

export interface IBillsTableProps {
  bills: Bill[];
  /** Numbers a restore lost; each is shown as a "Lost in restore" row above the bills. */
  gaps: IRecordedNumberGap[];
  /** Called with the id of the bill whose number was chosen. */
  onOpen: (billId: string) => void;
}
