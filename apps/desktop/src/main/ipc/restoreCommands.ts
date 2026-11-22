import { CoreError, type BackupPlanRestoreInput, type IRestorePreview } from "@shopos/core";
import { validateBackupFile } from "../services/BackupService";
import { planRestoreNumbering, type IRestoreNumberingPlan } from "../services/RestoreNumbering";

/**
 * Work out what restoring this file would do to the bill numbers. Changes nothing. INVALID_BACKUP for
 * a file that is not a backup, INVALID_FIELD for a bill number that does not fit.
 */
export function planRestoreFor(
  input: BackupPlanRestoreInput,
  now: Date,
): Promise<IRestoreNumberingPlan> {
  validateBackupFile(input.filePath);
  return planRestoreNumbering(input.filePath, input.lastIssuedBillNo ?? null, now);
}

/** The part of a plan the owner sees: the next number, and the numbers recorded as lost. */
export function toRestorePreview(plan: IRestoreNumberingPlan): IRestorePreview {
  const { gap } = plan;
  return {
    nextBillNo: plan.nextBillNo,
    ...(gap && {
      gapRecorded: { seqFrom: gap.seqFrom, seqTo: gap.seqTo, isEstimated: gap.isEstimated },
    }),
  };
}

/**
 * The plan worked out now must give the next number the owner confirmed. If it does not, the file
 * changed after they checked it, and applying it unseen could reuse a printed number (FR-013b).
 */
export function assertPlanIsConfirmed(
  plan: IRestoreNumberingPlan,
  confirmedNextBillNo: string,
): void {
  const isConfirmedPlan = plan.nextBillNo === confirmedNextBillNo;
  if (isConfirmedPlan) {
    return;
  }
  throw new CoreError(
    "INVALID_BACKUP",
    "The backup changed after you checked it. Check the restore again.",
  );
}
