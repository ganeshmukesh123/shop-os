import type { IRecordedNumberGap } from "@shopos/core";

export interface IUseBillGapsResult {
  gaps: IRecordedNumberGap[];
  /** True until the current bills.gaps request has answered. */
  loading: boolean;
  /** The reason the gaps could not be read, or null. */
  error: string | null;
}
