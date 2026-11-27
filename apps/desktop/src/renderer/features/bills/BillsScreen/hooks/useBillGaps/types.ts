import type { IRecordedNumberGap } from "@shopos/core";

export interface IUseBillGapsResult {
  gaps: IRecordedNumberGap[];
  /** The reason the gaps could not be read, or null. */
  error: string | null;
}
