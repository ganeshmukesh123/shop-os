import { and, eq, isNotNull } from "drizzle-orm";
import type { Handle } from "../../db/connection";
import { newId, nowMs } from "../../db/ids";
import { bill, billLine } from "../../db/schema";
import type { Ctx } from "../../db/seed";
import { billLineTint } from "../../db/tintSchema";

/** One colorant of a tinted can as saved on the bill: per can, in thousandths of a ml. */
export interface ISavedColorant {
  colorantVariantId: string;
  colorantNameSnapshot: string;
  qtyMilli: number;
  costPaise: number;
}

/** A billed tinted line, for a repeat order (contracts "Bills (changed)"). */
export interface ITintedSourceLine {
  variantId: string;
  formulaId: string;
  colorants: ISavedColorant[];
}

/** bill_line_tint: the append-only snapshot of what was mixed in each tinted can (spec 002 T061). */
export class BillTintRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  /** A tinted line of this shop's bills with its colorants, or null (missing, other shop, not tinted). */
  sourceLine(billLineId: string): ITintedSourceLine | null {
    const lineRow = this.databaseHandle
      .select({ variantId: billLine.variantId, formulaId: billLine.tintFormulaId })
      .from(billLine)
      .innerJoin(bill, eq(bill.id, billLine.billId))
      .where(
        and(
          eq(billLine.id, billLineId),
          eq(bill.shopId, this.ctx.shopId),
          isNotNull(billLine.tintFormulaId),
        ),
      )
      .get();
    if (!lineRow?.formulaId) return null;
    const colorants = this.databaseHandle
      .select({
        colorantVariantId: billLineTint.colorantVariantId,
        colorantNameSnapshot: billLineTint.colorantNameSnapshot,
        qtyMilli: billLineTint.qtyMilli,
        costPaise: billLineTint.costPaise,
      })
      .from(billLineTint)
      .where(eq(billLineTint.billLineId, billLineId))
      .all();
    return colorants.length === 0
      ? null
      : { variantId: lineRow.variantId, formulaId: lineRow.formulaId, colorants };
  }

  insertColorants(billLineId: string, colorants: readonly ISavedColorant[]): void {
    const now = nowMs();
    this.databaseHandle
      .insert(billLineTint)
      .values(
        colorants.map((colorant) => ({
          id: newId(),
          businessId: this.ctx.businessId,
          shopId: this.ctx.shopId,
          createdAt: now,
          updatedAt: now,
          billLineId,
          ...colorant,
        })),
      )
      .run();
  }
}
