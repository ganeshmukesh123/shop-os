import { and, eq } from "drizzle-orm";
import type { Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { itemBarcode } from "../../db/variantDetailSchema";

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
}
