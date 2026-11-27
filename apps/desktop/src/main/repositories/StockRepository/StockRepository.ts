import { and, asc, eq, sql } from "drizzle-orm";
import { CoreError, movementLocations, signedQuantityMilli } from "@shopos/core";
import type { MovementReason, StockMovement } from "@shopos/core";
import type { Handle } from "../../db/connection";
import { isoOfMs, newId, nowMs } from "../../db/ids";
import { location, stockMovement } from "../../db/schema";
import type { Ctx } from "../../db/seed";

type Row = typeof stockMovement.$inferSelect;

const BILL_DOC_TYPE = "bill";

/** The sum of a variant's movements: stock in adds, stock out subtracts (direction = locations). */
const SIGNED_QUANTITY = sql`case when ${stockMovement.toLocationId} is not null then ${stockMovement.qtyBaseMilli} else -${stockMovement.qtyBaseMilli} end`;

/** The screens and services still see a signed quantity; the table stores it as locations. */
const toMovement = (movementRow: Row): StockMovement => ({
  id: movementRow.id,
  itemId: movementRow.variantId,
  quantityMilli: signedQuantityMilli(movementRow),
  reason: movementRow.movementType as MovementReason,
  note: movementRow.note,
  billId: movementRow.docType === BILL_DOC_TYPE ? movementRow.docId : null,
  occurredAt: isoOfMs(movementRow.occurredAt),
});

/** Insert-only: there is deliberately no update or delete method. */
export class StockRepository {
  private shopFloorLocationId: string | undefined;

  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  /** This release has one location, the seeded "Shop floor" (feature 007 adds more). */
  private shopFloorId(): string {
    if (this.shopFloorLocationId) return this.shopFloorLocationId;
    const shopFloor = this.databaseHandle
      .select({ id: location.id })
      .from(location)
      .where(and(eq(location.shopId, this.ctx.shopId), eq(location.kind, "shop_floor")))
      .get();
    if (!shopFloor) throw new CoreError("INTERNAL", "This shop has no shop floor location");
    this.shopFloorLocationId = shopFloor.id;
    return shopFloor.id;
  }

  append(newMovement: {
    itemId: string;
    quantityMilli: number;
    reason: MovementReason;
    note?: string | null;
    billId?: string | null;
  }): StockMovement {
    const now = nowMs();
    const billId = newMovement.billId ?? null;
    const row = this.databaseHandle
      .insert(stockMovement)
      .values({
        id: newId(),
        businessId: this.ctx.businessId,
        shopId: this.ctx.shopId,
        createdAt: now,
        updatedAt: now,
        variantId: newMovement.itemId,
        movementType: newMovement.reason,
        ...movementLocations(newMovement.quantityMilli, this.shopFloorId()),
        docType: billId ? BILL_DOC_TYPE : null,
        docId: billId,
        note: newMovement.note ?? null,
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
        .select({ totalQuantityMilli: sql<number>`coalesce(sum(${SIGNED_QUANTITY}), 0)` })
        .from(stockMovement)
        .where(eq(stockMovement.variantId, itemId))
        .get()?.totalQuantityMilli ?? 0
    );
  }

  forItem(itemId: string): StockMovement[] {
    return this.databaseHandle
      .select()
      .from(stockMovement)
      .where(eq(stockMovement.variantId, itemId))
      .orderBy(asc(stockMovement.occurredAt), asc(stockMovement.id))
      .all()
      .map(toMovement);
  }

  forBill(billId: string): StockMovement[] {
    return this.databaseHandle
      .select()
      .from(stockMovement)
      .where(and(eq(stockMovement.docType, BILL_DOC_TYPE), eq(stockMovement.docId, billId)))
      .all()
      .map(toMovement);
  }

  all(): StockMovement[] {
    return this.databaseHandle.select().from(stockMovement).all().map(toMovement);
  }
}
