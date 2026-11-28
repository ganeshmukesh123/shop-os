import { asc, eq } from "drizzle-orm";
import type { ITintChargeRow } from "@shopos/core";
import type { Handle } from "../../db/connection";
import { newId, nowMs } from "../../db/ids";
import type { Ctx } from "../../db/seed";
import { tintChargeRule } from "../../db/tintSchema";

/** The tint charge per declared pack size (spec 002 T060, FR-015). Master data. */
export class TintChargeRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  private rowBase() {
    const now = nowMs();
    return {
      id: newId(),
      businessId: this.ctx.businessId,
      shopId: this.ctx.shopId,
      createdAt: now,
      updatedAt: now,
    };
  }

  listCharges(): ITintChargeRow[] {
    return this.databaseHandle
      .select({
        declaredQtyMilli: tintChargeRule.declaredQtyMilli,
        declaredUom: tintChargeRule.declaredUom,
        chargePaise: tintChargeRule.chargePaise,
      })
      .from(tintChargeRule)
      .where(eq(tintChargeRule.businessId, this.ctx.businessId))
      .orderBy(asc(tintChargeRule.declaredUom), asc(tintChargeRule.declaredQtyMilli))
      .all();
  }

  /** The charge list is master data: saving replaces it. */
  replaceCharges(rules: readonly ITintChargeRow[]): void {
    this.databaseHandle
      .delete(tintChargeRule)
      .where(eq(tintChargeRule.businessId, this.ctx.businessId))
      .run();
    if (rules.length === 0) return;
    this.databaseHandle
      .insert(tintChargeRule)
      .values(rules.map((rule) => ({ ...this.rowBase(), ...rule })))
      .run();
  }
}
