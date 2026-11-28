import type { Bill, BillLine } from "@shopos/core";

export interface IUseOpenBillResult {
  /** The bill and its lines, or null while loading or when it could not be read. */
  opened: { bill: Bill; lines: BillLine[] } | null;
  error: string | null;
}
