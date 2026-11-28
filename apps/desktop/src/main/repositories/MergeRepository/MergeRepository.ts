import { and, eq, inArray, sql } from "drizzle-orm";
import type { IMergeLog, IMergeMove } from "@shopos/core";
import type { Handle } from "../../db/connection";
import { newId, nowMs } from "../../db/ids";
import { itemVariant } from "../../db/itemSchema";
import { itemMergeLog } from "../../db/mergeLogSchema";
import type { Ctx } from "../../db/seed";
import { stockMovement } from "../../db/stockSchema";
import { itemBatch } from "../../db/variantDetailSchema";
import { toMergeLog } from "./mergeLogRows";

export type INewMergeLog = Omit<IMergeLog, "id" | "createdAt">;

/** Stock moves, batch ownership and the log of item merges (spec 002 research D6). */
export class MergeRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  /** The variant's non-zero balance in each location and batch, signed (negative stock stays negative). */
  balancesOf(variantId: string): IMergeMove[] {
    const locationId = sql<string>`coalesce(${stockMovement.toLocationId}, ${stockMovement.fromLocationId})`;
    const signedQty = sql<number>`sum(case when ${stockMovement.toLocationId} is not null then ${stockMovement.qtyBaseMilli} else -${stockMovement.qtyBaseMilli} end)`;
    return this.databaseHandle
      .select({ locationId, batchId: stockMovement.batchId, qtyMilli: signedQty })
      .from(stockMovement)
      .where(and(eq(stockMovement.variantId, variantId), eq(stockMovement.shopId, this.ctx.shopId)))
      .groupBy(locationId, stockMovement.batchId)
      .having(sql`${signedQty} <> 0`)
      .orderBy(locationId)
      .all();
  }

  /**
   * Move `move.qtyMilli` (positive) at one location and batch from one variant to another: one
   * merge_out from `fromVariantId`, one merge_in to `toVariantId`, both carrying the merge log.
   */
  moveStock(
    fromVariantId: string,
    toVariantId: string,
    move: IMergeMove,
    mergeLogId: string,
  ): void {
    const now = nowMs();
    const common = {
      businessId: this.ctx.businessId,
      shopId: this.ctx.shopId,
      createdAt: now,
      updatedAt: now,
      qtyBaseMilli: move.qtyMilli,
      batchId: move.batchId,
      docType: "item_merge",
      docId: mergeLogId,
      occurredAt: now,
      deviceId: this.ctx.deviceId,
    };
    this.databaseHandle
      .insert(stockMovement)
      .values([
        {
          id: newId(),
          ...common,
          variantId: fromVariantId,
          movementType: "merge_out",
          fromLocationId: move.locationId,
        },
        {
          id: newId(),
          ...common,
          variantId: toVariantId,
          movementType: "merge_in",
          toLocationId: move.locationId,
        },
      ])
      .run();
  }

  batchIdsOf(variantId: string): string[] {
    return this.databaseHandle
      .select({ id: itemBatch.id })
      .from(itemBatch)
      .where(and(eq(itemBatch.variantId, variantId), eq(itemBatch.shopId, this.ctx.shopId)))
      .all()
      .map(({ id }) => id);
  }

  /** Give batches to another variant, keeping their ids, receipt times and MRP. */
  reassignBatches(batchIds: readonly string[], toVariantId: string): void {
    if (batchIds.length === 0) return;
    this.databaseHandle
      .update(itemBatch)
      .set({ variantId: toVariantId, updatedAt: nowMs() })
      .where(inArray(itemBatch.id, [...batchIds]))
      .run();
  }

  /** B points at its survivor and is no longer sold, or (survivor null) is restored by a reversal. */
  setMergedInto(variantId: string, survivorId: string | null): void {
    this.databaseHandle
      .update(itemVariant)
      .set({ mergedIntoId: survivorId, isActive: survivorId === null ? 1 : 0, updatedAt: nowMs() })
      .where(and(eq(itemVariant.id, variantId), eq(itemVariant.shopId, this.ctx.shopId)))
      .run();
  }

  insertLog(newLog: INewMergeLog, movedRows: readonly unknown[] = []): IMergeLog {
    const now = nowMs();
    const logRow = this.databaseHandle
      .insert(itemMergeLog)
      .values({
        id: newId(),
        businessId: this.ctx.businessId,
        shopId: this.ctx.shopId,
        createdAt: now,
        updatedAt: now,
        action: newLog.action,
        survivorId: newLog.survivorId,
        mergedId: newLog.mergedId,
        mergeLogId: newLog.mergeLogId,
        movedJson: JSON.stringify(newLog.moved),
        movedBatchIds: JSON.stringify(newLog.movedBatchIds),
        movedBarcodeIds: JSON.stringify(newLog.movedBarcodeIds),
        movedSearchNameIds: JSON.stringify(newLog.movedSearchNameIds),
        movedRowsJson: JSON.stringify(movedRows),
        reason: newLog.reason,
        userLabel: newLog.userLabel,
        reversibleUntil: newLog.reversibleUntil,
      })
      .returning()
      .get();
    return toMergeLog(logRow);
  }
}
