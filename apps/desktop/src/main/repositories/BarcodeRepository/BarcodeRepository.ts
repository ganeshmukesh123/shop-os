import { and, asc, eq, notInArray } from "drizzle-orm";
import type { IBarcode } from "@shopos/core";
import type { Handle } from "../../db/connection";
import { newId, nowMs } from "../../db/ids";
import type { Ctx } from "../../db/seed";
import { itemBarcode } from "../../db/variantDetailSchema";

export type INewBarcode = Pick<IBarcode, "code" | "source">;

/** Barcodes of this shop's variants (spec 002 T045, research D7: duplicates allowed). */
export class BarcodeRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  /** The variants holding this exact code, merged ones included (the caller follows merges). */
  ownersOf(code: string): string[] {
    return this.databaseHandle
      .select({ variantId: itemBarcode.variantId })
      .from(itemBarcode)
      .where(and(eq(itemBarcode.code, code), eq(itemBarcode.shopId, this.ctx.shopId)))
      .all()
      .map(({ variantId }) => variantId);
  }

  listFor(variantId: string): IBarcode[] {
    return this.databaseHandle
      .select({
        id: itemBarcode.id,
        variantId: itemBarcode.variantId,
        code: itemBarcode.code,
        source: itemBarcode.source,
      })
      .from(itemBarcode)
      .where(and(eq(itemBarcode.variantId, variantId), eq(itemBarcode.shopId, this.ctx.shopId)))
      .orderBy(asc(itemBarcode.code))
      .all() as IBarcode[];
  }

  /** Make the variant's codes exactly `barcodes`: remove the others, add the new, update sources. */
  replaceFor(variantId: string, barcodes: readonly INewBarcode[]): void {
    const ofVariant = and(
      eq(itemBarcode.variantId, variantId),
      eq(itemBarcode.shopId, this.ctx.shopId),
    );
    const codes = barcodes.map(({ code }) => code);
    this.databaseHandle
      .delete(itemBarcode)
      .where(codes.length === 0 ? ofVariant : and(ofVariant, notInArray(itemBarcode.code, codes)))
      .run();
    const now = nowMs();
    barcodes.forEach((barcode) =>
      this.databaseHandle
        .insert(itemBarcode)
        .values({
          id: newId(),
          businessId: this.ctx.businessId,
          shopId: this.ctx.shopId,
          createdAt: now,
          updatedAt: now,
          variantId,
          code: barcode.code,
          source: barcode.source,
        })
        .onConflictDoUpdate({
          target: [itemBarcode.variantId, itemBarcode.code],
          set: { source: barcode.source, updatedAt: now },
        })
        .run(),
    );
  }
}
