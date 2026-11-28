import {
  CoreError,
  itemsMergeReverseInput,
  type IMergeLog,
  type ItemsMergeReverseInput,
} from "@shopos/core";
import type { Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { MergeRepository } from "../../repositories/MergeRepository";
import {
  VariantCodesRepository,
  type IMovedCodeRow,
} from "../../repositories/VariantCodesRepository";
import { MERGE_USER_LABEL } from "./constants";
import { moveLoggedStock } from "./moveLoggedStock";

/** Read the merge to reverse and refuse what D6 forbids. */
function readReversible(handle: Handle, ctx: Ctx, mergeLogId: string, now: Date) {
  const merges = new MergeRepository(handle, ctx);
  const found = merges.getLog(mergeLogId);
  if (!found || found.mergeLog.action !== "merge") {
    throw new CoreError("NOT_FOUND", "This merge is not here any more");
  }
  if (merges.isReversed(mergeLogId)) {
    throw new CoreError("ALREADY_REVERSED", "This merge has already been reversed");
  }
  if (now.getTime() > (found.mergeLog.reversibleUntil ?? 0)) {
    throw new CoreError("REVERSAL_WINDOW_CLOSED", "A merge can be reversed for 30 days only");
  }
  const survivor = new FamilyRepository(handle, ctx).getVariant(found.mergeLog.survivorId);
  if (survivor?.mergedIntoId) {
    throw new CoreError(
      "SURVIVOR_MERGED",
      "The kept item was merged again later. Reverse that later merge first",
    );
  }
  return found;
}

/**
 * Undo a merge in the caller's transaction: opposite movements for what was moved, the logged
 * batches and code rows back to B, B pointed at nothing and active again, and a reverse log row.
 * Sales of A after the merge stay on A.
 */
export function reverseMerge(
  handle: Handle,
  ctx: Ctx,
  raw: ItemsMergeReverseInput,
  now: Date,
): IMergeLog {
  const input = itemsMergeReverseInput.parse(raw);
  const reason = input.reason.trim();
  if (reason === "") throw new CoreError("REASON_REQUIRED", "Say why this merge is reversed");
  const { mergeLog, movedRows } = readReversible(handle, ctx, input.mergeLogId, now);
  const merges = new MergeRepository(handle, ctx);
  const reverseLog = merges.insertLog({
    ...mergeLog,
    action: "reverse",
    mergeLogId: mergeLog.id,
    reason,
    userLabel: MERGE_USER_LABEL,
    reversibleUntil: null,
  });
  moveLoggedStock(handle, ctx, { moves: mergeLog.moved, docId: reverseLog.id }, [
    mergeLog.survivorId,
    mergeLog.mergedId,
  ]);
  merges.reassignBatches(mergeLog.movedBatchIds, mergeLog.mergedId);
  new VariantCodesRepository(handle, ctx).restore(movedRows as IMovedCodeRow[]);
  merges.setMergedInto(mergeLog.mergedId, null);
  return reverseLog;
}
