import {
  CoreError,
  itemsMergeInput,
  type IMergeLog,
  type IVariant,
  type Item,
  type ItemsMergeInput,
} from "@shopos/core";
import type { DB, Handle } from "../../db/connection";
import { nowMs } from "../../db/ids";
import type { Ctx } from "../../db/seed";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { ItemRepository } from "../../repositories/ItemRepository";
import { MergeRepository } from "../../repositories/MergeRepository";
import { VariantCodesRepository } from "../../repositories/VariantCodesRepository";
import type { SearchService } from "../search";

/** A merge may be reversed for this long (FR-ITM-009, research D6). */
export const REVERSAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Who merged: one user until roles arrive in feature 005. */
export const MERGE_USER_LABEL = "Owner";

export type IMergeSearchRefresher = Pick<SearchService, "refreshAfterMerge">;

/**
 * items.merge (spec 002 T046, research D6): in ONE transaction, move B's stock to survivor A with a
 * merge_out and a merge_in per location and batch, give A B's batches and noncolliding codes and
 * names, point B at A and deactivate it, and log it all. Saved bill lines never change.
 */
export class MergeService {
  constructor(
    private readonly db: DB,
    private readonly ctx: Ctx,
    private readonly search?: IMergeSearchRefresher,
  ) {}

  merge(raw: ItemsMergeInput): { mergeLog: IMergeLog; survivor: Item } {
    const input = itemsMergeInput.parse(raw);
    const reason = input.reason.trim();
    if (reason === "") throw new CoreError("REASON_REQUIRED", "Say why these items are merged");
    if (input.survivorId === input.mergedId) {
      throw new CoreError("SAME_ITEM", "Choose two different items to merge");
    }
    const result = this.db.transaction((transaction) => {
      const { survivor, merged } = this.readPair(transaction, input.survivorId, input.mergedId);
      const mergeLog = this.moveEverything(transaction, survivor, merged, reason);
      return { mergeLog, survivor: new ItemRepository(transaction, this.ctx).get(survivor.id)! };
    });
    this.search?.refreshAfterMerge(input.survivorId, input.mergedId);
    return result;
  }

  private readPair(handle: Handle, survivorId: string, mergedId: string) {
    const families = new FamilyRepository(handle, this.ctx);
    const survivor = families.getVariant(survivorId);
    const merged = families.getVariant(mergedId);
    if (!survivor || !merged)
      throw new CoreError("NOT_FOUND", "One of these items is not here any more");
    if (survivor.mergedIntoId !== null || merged.mergedIntoId !== null) {
      throw new CoreError("ALREADY_MERGED", "One of these items is already merged into another");
    }
    if (survivor.baseUom !== merged.baseUom) {
      throw new CoreError(
        "UNIT_MISMATCH",
        `These items are counted in different units (${survivor.baseUom} and ${merged.baseUom})`,
      );
    }
    return { survivor, merged };
  }

  private moveEverything(
    handle: Handle,
    survivor: IVariant,
    merged: IVariant,
    reason: string,
  ): IMergeLog {
    const merges = new MergeRepository(handle, this.ctx);
    const balances = merges.balancesOf(merged.id);
    const batchIds = merges.batchIdsOf(merged.id);
    const movedRows = new VariantCodesRepository(handle, this.ctx).moveNoncolliding(
      merged.id,
      survivor.id,
    );
    const idsOf = (table: string) =>
      movedRows.filter((row) => row.table === table).map(({ id }) => id);
    const mergeLog = merges.insertLog(
      {
        action: "merge",
        survivorId: survivor.id,
        mergedId: merged.id,
        mergeLogId: null,
        moved: balances,
        movedBatchIds: batchIds,
        movedBarcodeIds: idsOf("item_barcode"),
        movedSearchNameIds: idsOf("item_search_name"),
        reason,
        userLabel: MERGE_USER_LABEL,
        reversibleUntil: nowMs() + REVERSAL_WINDOW_MS,
      },
      movedRows,
    );
    this.moveStock(handle, mergeLog, merged.id, survivor.id);
    merges.reassignBatches(batchIds, survivor.id);
    merges.setMergedInto(merged.id, survivor.id);
    return mergeLog;
  }

  /**
   * Move the logged balances from `fromId` to `toId` and keep both cached stocks equal to their
   * movements. A positive balance goes from-to; a negative one is moved the other way (D6 step 3).
   */
  private moveStock(handle: Handle, mergeLog: IMergeLog, fromId: string, toId: string): void {
    const merges = new MergeRepository(handle, this.ctx);
    mergeLog.moved.forEach((balance) =>
      balance.qtyMilli > 0
        ? merges.moveStock(fromId, toId, balance, mergeLog.id)
        : merges.moveStock(toId, fromId, { ...balance, qtyMilli: -balance.qtyMilli }, mergeLog.id),
    );
    const movedMilli = mergeLog.moved.reduce((total, balance) => total + balance.qtyMilli, 0);
    const items = new ItemRepository(handle, this.ctx);
    items.addStockDelta(toId, movedMilli);
    items.addStockDelta(fromId, -movedMilli);
  }
}
