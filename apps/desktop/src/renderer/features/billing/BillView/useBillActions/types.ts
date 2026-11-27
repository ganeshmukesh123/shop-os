/** Which bill action is running. */
export type BillAction = "print" | "pdf";

export interface IBillActions {
  /** The action running now, or null. */
  busy: BillAction | null;
  /** Why the last print or PDF failed, or null. */
  actionError: string | null;
  print: () => Promise<void>;
  pdf: () => Promise<void>;
}
