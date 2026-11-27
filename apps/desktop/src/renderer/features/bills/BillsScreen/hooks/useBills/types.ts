import type { Bill } from "@shopos/core";

export interface IUseBillsResult {
  bills: Bill[];
  /** Every bill that matches the filter, not only the ones in `bills`. */
  total: number;
  loading: boolean;
  /** The reason the list could not be read, or null. */
  error: string | null;
}
