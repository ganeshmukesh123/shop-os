import { and, eq } from "drizzle-orm";
import type { Handle } from "../db/connection";
import { bill } from "../db/schema";
import type { Ctx } from "../db/seed";

/**
 * The one change a saved bill may ever get: posted to cancelled, with a reason and a time.
 * The database trigger `bill_only_cancel_update` refuses every other change to a bill.
 */
export class BillCancelRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  /** True when the bill was posted and is now cancelled; false when it was already cancelled or is not this shop's. */
  markCancelled(billId: string, reason: string, cancelledAtMs: number): boolean {
    const cancelledRow = this.databaseHandle
      .update(bill)
      .set({
        status: "cancelled",
        cancelReason: reason,
        cancelledAt: cancelledAtMs,
        updatedAt: cancelledAtMs,
      })
      .where(and(eq(bill.id, billId), eq(bill.shopId, this.ctx.shopId), eq(bill.status, "posted")))
      .returning({ id: bill.id })
      .get();
    return cancelledRow !== undefined;
  }
}
