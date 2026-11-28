import { and, countDistinct, eq, gte, inArray, max, sql, sum } from "drizzle-orm";
import type { DB, Handle } from "../../db/connection";
import { newId, nowMs } from "../../db/ids";
import { bill, billLine } from "../../db/schema";
import type { Ctx } from "../../db/seed";
import { itemSalesStat } from "../../db/variantDetailSchema";

/** The ranking window (research D4): sales in the last 90 days. */
export const SALES_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

/** One saved bill line, in the base unit. */
export interface ISoldLine {
  itemId: string;
  quantityMilli: number;
}

/**
 * item_sales_stat, a projection of posted bill lines (spec 002 T048, data-model). A save adds to
 * it; a cancel and the rebuild recompute rows from the bills of the last 90 days.
 */
export class SalesStatRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  /** Add one saved bill: each item's quantity, one bill per item however many lines it has. */
  recordSale(billedAt: number, lines: readonly ISoldLine[]): void {
    const soldMilliByItem = new Map<string, number>();
    lines.forEach(({ itemId, quantityMilli }) =>
      soldMilliByItem.set(itemId, (soldMilliByItem.get(itemId) ?? 0) + quantityMilli),
    );
    soldMilliByItem.forEach((soldMilli, variantId) =>
      this.databaseHandle
        .insert(itemSalesStat)
        .values({
          ...this.newRowBase(),
          variantId,
          soldQty90dMilli: soldMilli,
          billCount90d: 1,
          lastSoldAt: billedAt,
        })
        .onConflictDoUpdate({
          target: itemSalesStat.variantId,
          set: {
            soldQty90dMilli: sql`${itemSalesStat.soldQty90dMilli} + ${soldMilli}`,
            billCount90d: sql`${itemSalesStat.billCount90d} + 1`,
            lastSoldAt: sql`max(coalesce(${itemSalesStat.lastSoldAt}, 0), ${billedAt})`,
            updatedAt: nowMs(),
          },
        })
        .run(),
    );
  }

  /** Recompute rows from posted bills since `now` - 90 days: these variants, or (none given) all. */
  recompute(now: Date, variantIds?: readonly string[]): void {
    const variantFilter = variantIds ? [inArray(billLine.variantId, [...variantIds])] : [];
    const totals = this.databaseHandle
      .select({
        variantId: billLine.variantId,
        soldQty90dMilli: sum(billLine.qtyBaseMilli).mapWith(Number),
        billCount90d: countDistinct(billLine.billId),
        lastSoldAt: max(bill.billedAt),
      })
      .from(billLine)
      .innerJoin(bill, eq(bill.id, billLine.billId))
      .where(
        and(
          eq(bill.shopId, this.ctx.shopId),
          eq(bill.status, "posted"),
          gte(bill.billedAt, now.getTime() - SALES_WINDOW_MS),
          ...variantFilter,
        ),
      )
      .groupBy(billLine.variantId)
      .all();
    const ofShop = eq(itemSalesStat.shopId, this.ctx.shopId);
    this.databaseHandle
      .delete(itemSalesStat)
      .where(variantIds ? and(ofShop, inArray(itemSalesStat.variantId, [...variantIds])) : ofShop)
      .run();
    if (totals.length > 0) {
      this.databaseHandle
        .insert(itemSalesStat)
        .values(totals.map((total) => ({ ...this.newRowBase(), ...total })))
        .run();
    }
  }

  private newRowBase() {
    const now = nowMs();
    return {
      id: newId(),
      businessId: this.ctx.businessId,
      shopId: this.ctx.shopId,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** Rebuild the whole projection from bill lines, in one transaction (at start, and on demand). */
export function rebuildItemSalesStats(db: DB, ctx: Ctx, now: Date = new Date()): void {
  db.transaction((transaction) => new SalesStatRepository(transaction, ctx).recompute(now));
}
