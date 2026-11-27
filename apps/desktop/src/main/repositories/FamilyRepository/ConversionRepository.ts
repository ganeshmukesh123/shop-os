import { and, asc, eq, inArray } from "drizzle-orm";
import type { IUnitConversion } from "@shopos/core";
import type { Handle } from "../../db/connection";
import { newId, nowMs } from "../../db/ids";
import { unitConversion } from "../../db/variantDetailSchema";
import type { Ctx } from "../../db/seed";

/** A variant's alternate units (spec 002 data-model.md "unit_conversion"). */
export class ConversionRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  listFor(variantIds: readonly string[]): IUnitConversion[] {
    if (variantIds.length === 0) return [];
    return this.databaseHandle
      .select({
        variantId: unitConversion.variantId,
        uomCode: unitConversion.uomCode,
        factorMilli: unitConversion.factorMilli,
      })
      .from(unitConversion)
      .where(
        and(
          eq(unitConversion.shopId, this.ctx.shopId),
          inArray(unitConversion.variantId, [...variantIds]),
        ),
      )
      .orderBy(asc(unitConversion.uomCode))
      .all();
  }

  /** Replace the variant's conversions with `conversions` (the caller runs this in a transaction). */
  replace(variantId: string, conversions: readonly Omit<IUnitConversion, "variantId">[]): void {
    this.databaseHandle
      .delete(unitConversion)
      .where(
        and(eq(unitConversion.variantId, variantId), eq(unitConversion.shopId, this.ctx.shopId)),
      )
      .run();
    if (conversions.length === 0) return;
    const now = nowMs();
    this.databaseHandle
      .insert(unitConversion)
      .values(
        conversions.map((conversion) => ({
          id: newId(),
          businessId: this.ctx.businessId,
          shopId: this.ctx.shopId,
          createdAt: now,
          updatedAt: now,
          variantId,
          ...conversion,
        })),
      )
      .run();
  }
}
