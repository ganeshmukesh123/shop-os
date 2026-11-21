import { eq, max } from "drizzle-orm";
import type { Handle } from "../db/connection";
import { bill } from "../db/schema";
import type { Ctx } from "../db/seed";

/** Reads the time of the newest saved bill, so the app can notice a clock that went backwards. */
export class BillClockRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  /** When the newest bill was saved (epoch milliseconds), or null when the shop has none yet. */
  lastBilledAt(): number | null {
    const newestRow = this.databaseHandle
      .select({ lastBilledAt: max(bill.billedAt) })
      .from(bill)
      .where(eq(bill.shopId, this.ctx.shopId))
      .get();
    return newestRow?.lastBilledAt ?? null;
  }
}
