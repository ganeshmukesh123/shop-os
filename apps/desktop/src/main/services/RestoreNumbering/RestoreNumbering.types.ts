import type { INumberGapPlan } from "@shopos/core";

/** Where a restore puts the database, and the migrations that bring an older backup up to date. */
export interface IRestoreTarget {
  databasePath: string;
  migrationsFolder: string;
}

/** What a restore will do to the bill numbers, worked out before anything is replaced. */
export interface IRestoreNumberingPlan {
  /** The series the lost numbers belong to: counter code, financial year and number format. */
  counterCode: string;
  financialYear: string;
  template: string;
  /** The last number the backup had in that series (0 when it had none). */
  restoredLastSeq: number;
  /** The numbers to record as lost, or null when nothing was lost. */
  gap: INumberGapPlan | null;
  /** The number the next bill will get after the restore. */
  nextBillNo: string;
}
