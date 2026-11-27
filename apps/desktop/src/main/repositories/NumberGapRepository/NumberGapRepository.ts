import { and, eq } from "drizzle-orm";
import { GAP_REASON_LOST_IN_RESTORE, type INumberGapPlan } from "@shopos/core";
import type { Handle } from "../../db/connection";
import { newId } from "../../db/ids";
import { billNumberGap, numberSeries } from "../../db/schema";
import type { Ctx } from "../../db/seed";

/** Writes the numbers a restore lost. Gap rows are insert-only; the database triggers forbid edits. */
export class NumberGapRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  private base(nowMs: number) {
    return {
      id: newId(),
      businessId: this.ctx.businessId,
      shopId: this.ctx.shopId,
      createdAt: nowMs,
      updatedAt: nowMs,
    };
  }

  /** The series of a counter and financial year, started at 0 when the database has none yet. */
  ensureSeries(
    counterCode: string,
    financialYear: string,
    template: string,
    nowMs: number,
  ): { id: string; lastSeq: number } {
    const existingSeries = this.databaseHandle
      .select({ id: numberSeries.id, lastSeq: numberSeries.lastSeq })
      .from(numberSeries)
      .where(
        and(
          eq(numberSeries.shopId, this.ctx.shopId),
          eq(numberSeries.counterCode, counterCode),
          eq(numberSeries.financialYear, financialYear),
        ),
      )
      .get();
    if (existingSeries) return existingSeries;
    return this.databaseHandle
      .insert(numberSeries)
      .values({ ...this.base(nowMs), counterCode, financialYear, template, lastSeq: 0 })
      .returning({ id: numberSeries.id, lastSeq: numberSeries.lastSeq })
      .get();
  }

  /** Record that numbers seqFrom to seqTo of the series were lost in a restore. */
  recordGap(numberSeriesId: string, gap: INumberGapPlan, nowMs: number): void {
    this.databaseHandle
      .insert(billNumberGap)
      .values({
        ...this.base(nowMs),
        numberSeriesId,
        seqFrom: gap.seqFrom,
        seqTo: gap.seqTo,
        reason: GAP_REASON_LOST_IN_RESTORE,
        isEstimated: gap.isEstimated ? 1 : 0,
        recordedAt: nowMs,
      })
      .run();
  }

  /** Move the counter forward, so the next bill is `lastSeq + 1`. */
  setLastSeq(numberSeriesId: string, lastSeq: number, template: string, nowMs: number): void {
    this.databaseHandle
      .update(numberSeries)
      .set({ lastSeq, template, updatedAt: nowMs })
      .where(eq(numberSeries.id, numberSeriesId))
      .run();
  }
}
