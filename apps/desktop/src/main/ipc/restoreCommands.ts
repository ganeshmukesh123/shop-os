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

/** Same next number, and the same lost range (or none) with the same guess flag. */
function isSamePreview(planned: IRestorePreview, confirmed: IRestorePreview): boolean {
  const plannedGap = planned.gapRecorded;
  const confirmedGap = confirmed.gapRecorded;
  const isSameGap =
    plannedGap === undefined || confirmedGap === undefined
      ? plannedGap === confirmedGap
      : plannedGap.seqFrom === confirmedGap.seqFrom &&
        plannedGap.seqTo === confirmedGap.seqTo &&
        plannedGap.isEstimated === confirmedGap.isEstimated;
  return planned.nextBillNo === confirmed.nextBillNo && isSameGap;
}

/**
 * The plan worked out now must be the one the owner confirmed: the same next number and the same lost
 * range. If not, the file changed after they checked it, and applying it unseen could lose or reuse
 * numbers they never reviewed (FR-013b).
 */
export function assertPlanIsConfirmed(
  plan: IRestoreNumberingPlan,
  confirmedPreview: IRestorePreview,
): void {
  const isConfirmedPlan = isSamePreview(toRestorePreview(plan), confirmedPreview);
  if (isConfirmedPlan) {
    return;
  }
  throw new CoreError(
    "INVALID_BACKUP",
    "The backup changed after you checked it. Check the restore again.",
  );
}
