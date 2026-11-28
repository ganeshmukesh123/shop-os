import { and, asc, desc, eq, inArray, like, max, or, sql } from "drizzle-orm";
import type { ITintFormula, ITintFormulaLine, ITintShade } from "@shopos/core";
import type { Handle } from "../../db/connection";
import { newId, nowMs } from "../../db/ids";
import type { Ctx } from "../../db/seed";
import { tintFormula, tintFormulaLine, tintShade, tintShadePrice } from "../../db/tintSchema";

const SHADE_SEARCH_LIMIT = 50;

export type INewShade = Omit<ITintShade, "id">;

/** Shades, versioned formulas and tint charges (spec 002 T060, research D11). */
export class TintRepository {
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

  insertShade(shade: INewShade): ITintShade {
    return this.databaseHandle
      .insert(tintShade)
      .values({ ...this.rowBase(), ...shade })
      .returning()
      .get() as ITintShade;
  }

  getShade(shadeId: string): ITintShade | null {
    const shadeRow = this.databaseHandle
      .select()
      .from(tintShade)
      .where(and(eq(tintShade.id, shadeId), eq(tintShade.shopId, this.ctx.shopId)))
      .get();
    return (shadeRow as ITintShade | undefined) ?? null;
  }

  countCustomShades(): number {
    return this.databaseHandle
      .select({ id: tintShade.id })
      .from(tintShade)
      .where(and(eq(tintShade.shopId, this.ctx.shopId), eq(tintShade.source, "custom")))
      .all().length;
  }

  /** Shades whose name or code contains the query, ignoring case, by name. */
  searchShades(query: string, brandId?: string): ITintShade[] {
    const pattern = `%${query.toLowerCase().replace(/[\\%_]/g, (special) => `\\${special}`)}%`;
    return this.databaseHandle
      .select()
      .from(tintShade)
      .where(
        and(
          eq(tintShade.shopId, this.ctx.shopId),
          or(
            like(sql`lower(${tintShade.shadeName})`, pattern),
            like(sql`lower(${tintShade.shadeCode})`, pattern),
          ),
          ...(brandId ? [eq(tintShade.brandId, brandId)] : []),
        ),
      )
      .orderBy(asc(tintShade.shadeName))
      .limit(SHADE_SEARCH_LIMIT)
      .all() as ITintShade[];
  }

  /** Custom shades whose customer or site label contains the text, newest first. */
  customShadesFor(customerName?: string, siteLabel?: string): ITintShade[] {
    const containing = (text: string) =>
      `%${text.toLowerCase().replace(/[\\%_]/g, (special) => `\\${special}`)}%`;
    const labels = [
      ...(customerName
        ? [like(sql`lower(${tintShade.customerLabel})`, containing(customerName))]
        : []),
      ...(siteLabel ? [like(sql`lower(${tintShade.siteLabel})`, containing(siteLabel))] : []),
    ];
    if (labels.length === 0) return [];
    return this.databaseHandle
      .select()
      .from(tintShade)
      .where(
        and(eq(tintShade.shopId, this.ctx.shopId), eq(tintShade.source, "custom"), or(...labels)),
      )
      .orderBy(desc(tintShade.createdAt))
      .all() as ITintShade[];
  }

  /** Every version of the shade's formula for these base cans, with their colorant lines. */
  formulasFor(shadeId: string, baseVariantIds: readonly string[]): ITintFormula[] {
    if (baseVariantIds.length === 0) return [];
    const formulaRows = this.databaseHandle
      .select()
      .from(tintFormula)
      .where(
        and(
          eq(tintFormula.shadeId, shadeId),
          inArray(tintFormula.baseVariantId, [...baseVariantIds]),
        ),
      )
      .all();
    const lineRows =
      formulaRows.length === 0
        ? []
        : this.databaseHandle
            .select()
            .from(tintFormulaLine)
            .where(
              inArray(
                tintFormulaLine.formulaId,
                formulaRows.map(({ id }) => id),
              ),
            )
            .orderBy(asc(tintFormulaLine.createdAt))
            .all();
    return formulaRows.map((formulaRow) => ({
      id: formulaRow.id,
      shadeId: formulaRow.shadeId,
      baseVariantId: formulaRow.baseVariantId,
      version: formulaRow.version,
      lines: lineRows
        .filter((lineRow) => lineRow.formulaId === formulaRow.id)
        .map(({ colorantVariantId, qtyMilli }) => ({ colorantVariantId, qtyMilli })),
    }));
  }

  /** One formula version with its lines, or null. */
  getFormula(formulaId: string): ITintFormula | null {
    const formulaRow = this.databaseHandle
      .select({ shadeId: tintFormula.shadeId, baseVariantId: tintFormula.baseVariantId })
      .from(tintFormula)
      .where(and(eq(tintFormula.id, formulaId), eq(tintFormula.shopId, this.ctx.shopId)))
      .get();
    if (!formulaRow) return null;
    return (
      this.formulasFor(formulaRow.shadeId, [formulaRow.baseVariantId]).find(
        (formula) => formula.id === formulaId,
      ) ?? null
    );
  }

  /** The shade's own price on this base can, when the shade price list has one (FR-015). */
  shadePrice(shadeId: string, baseVariantId: string): number | null {
    const priceRow = this.databaseHandle
      .select({ pricePaise: tintShadePrice.pricePaise })
      .from(tintShadePrice)
      .where(
        and(eq(tintShadePrice.shadeId, shadeId), eq(tintShadePrice.baseVariantId, baseVariantId)),
      )
      .get();
    return priceRow?.pricePaise ?? null;
  }

  /** Every formula of a shade, for any base can. */
  formulasForShade(shadeId: string): ITintFormula[] {
    const baseIds = this.databaseHandle
      .selectDistinct({ baseVariantId: tintFormula.baseVariantId })
      .from(tintFormula)
      .where(and(eq(tintFormula.shadeId, shadeId), eq(tintFormula.shopId, this.ctx.shopId)))
      .all()
      .map(({ baseVariantId }) => baseVariantId);
    return this.formulasFor(shadeId, baseIds);
  }

  highestVersion(shadeId: string, baseVariantId: string): number {
    const [found] = this.databaseHandle
      .select({ highest: max(tintFormula.version) })
      .from(tintFormula)
      .where(and(eq(tintFormula.shadeId, shadeId), eq(tintFormula.baseVariantId, baseVariantId)))
      .all();
    return found?.highest ?? 0;
  }

  insertFormula(formula: Omit<ITintFormula, "id">): ITintFormula {
    const formulaRow = this.databaseHandle
      .insert(tintFormula)
      .values({
        ...this.rowBase(),
        shadeId: formula.shadeId,
        baseVariantId: formula.baseVariantId,
        version: formula.version,
      })
      .returning()
      .get();
    this.databaseHandle
      .insert(tintFormulaLine)
      .values(
        formula.lines.map((line: ITintFormulaLine) => ({
          ...this.rowBase(),
          formulaId: formulaRow.id,
          ...line,
        })),
      )
      .run();
    return { ...formula, id: formulaRow.id };
  }
}
