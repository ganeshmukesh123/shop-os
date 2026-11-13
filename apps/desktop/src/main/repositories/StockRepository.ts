import { asc, eq, sql } from "drizzle-orm";
import type { MovementReason, StockMovement } from "@shopos/core";
import type { Handle } from "../db/connection";
import { newId, nowIso } from "../db/ids";
import { stockMovement } from "../db/schema";
import type { Ctx } from "../db/seed";

type Row = typeof stockMovement.$inferSelect;

const toMovement = (movementRow: Row): StockMovement => ({
  id: movementRow.id,
  itemId: movementRow.itemId,
  quantityMilli: movementRow.quantityMilli,
  reason: movementRow.reason as MovementReason,
  note: movementRow.note,
  billId: movementRow.billId,
  occurredAt: movementRow.occurredAt,
});

/** Insert-only: there is deliberately no update or delete method. */
export class StockRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  append(newMovement: {
    itemId: string;
    quantityMilli: number;
    reason: MovementReason;
    note?: string | null;
    billId?: string | null;
  }): StockMovement {
    const now = nowIso();
    const row = this.databaseHandle
      .insert(stockMovement)
      .values({
        id: newId(),
        businessId: this.ctx.businessId,
        shopId: this.ctx.shopId,
        createdAt: now,
        updatedAt: now,
        itemId: newMovement.itemId,
        quantityMilli: newMovement.quantityMilli,
        reason: newMovement.reason,
        note: newMovement.note ?? null,
        billId: newMovement.billId ?? null,
        occurredAt: now,
        deviceId: this.ctx.deviceId,
      })
      .returning()
      .get();
    return toMovement(row);
  }

  sumForItem(itemId: string): number {
    return (
      this.databaseHandle
        .select({
          totalQuantityMilli: sql<number>`coalesce(sum(${stockMovement.quantityMilli}), 0)`,
        })
        .from(stockMovement)
        .where(eq(stockMovement.itemId, itemId))
        .get()?.totalQuantityMilli ?? 0
    );
  }

  forItem(itemId: string): StockMovement[] {
    return this.databaseHandle
      .select()
      .from(stockMovement)
      .where(eq(stockMovement.itemId, itemId))
      .orderBy(asc(stockMovement.occurredAt), asc(stockMovement.id))
      .all()
      .map(toMovement);
  }

  forBill(billId: string): StockMovement[] {
    return this.databaseHandle
      .select()
      .from(stockMovement)
      .where(eq(stockMovement.billId, billId))
      .all()
      .map(toMovement);
  }

  all(): StockMovement[] {
    return this.databaseHandle.select().from(stockMovement).all().map(toMovement);
  }
}
