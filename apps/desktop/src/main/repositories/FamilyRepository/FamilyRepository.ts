import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { IFamily, IVariant } from "@shopos/core";
import type { Handle } from "../../db/connection";
import { newId, nowMs } from "../../db/ids";
import { itemFamily, itemVariant } from "../../db/itemSchema";
import type { Ctx } from "../../db/seed";
import { ItemRepository } from "../ItemRepository";
import { toFamily, toVariant, type NewVariantRow } from "./familyRows";

export interface INewFamily {
  name: string;
  kind: string;
  categoryId: string | null;
  brandId: string | null;
  spec: Record<string, string>;
  axisKeys: string[];
}

/** Families and their variants (spec 002 data-model.md "Items"). One method, one purpose. */
export class FamilyRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  /** Another family of this name, ignoring case (DUPLICATE_NAME). */
  hasFamilyNamed(name: string, excludeId?: string): boolean {
    const exclude = excludeId ? [ne(itemFamily.id, excludeId)] : [];
    const match = this.databaseHandle
      .select({ id: itemFamily.id })
      .from(itemFamily)
      .where(
        and(
          eq(itemFamily.shopId, this.ctx.shopId),
          sql`${itemFamily.name} = ${name} COLLATE NOCASE`,
          ...exclude,
        ),
      )
      .get();
    return match !== undefined;
  }

  insertFamily(newFamily: INewFamily): IFamily {
    const familyRow = this.databaseHandle
      .insert(itemFamily)
      .values({
        id: newId(),
        ...this.stamp(),
        name: newFamily.name,
        kind: newFamily.kind,
        categoryId: newFamily.categoryId,
        brandId: newFamily.brandId,
        spec: JSON.stringify(newFamily.spec),
        axisKeys: JSON.stringify(newFamily.axisKeys),
      })
      .returning()
      .get();
    return toFamily(familyRow);
  }

  getFamily(familyId: string): IFamily | null {
    const familyRow = this.databaseHandle
      .select()
      .from(itemFamily)
      .where(and(eq(itemFamily.id, familyId), eq(itemFamily.shopId, this.ctx.shopId)))
      .get();
    return familyRow ? toFamily(familyRow) : null;
  }

  insertVariant(familyId: string, newVariant: NewVariantRow): IVariant {
    const itemCode = new ItemRepository(this.databaseHandle, this.ctx).nextItemCode();
    const variantRow = this.databaseHandle
      .insert(itemVariant)
      .values({ id: newId(), ...this.stamp(), familyId, itemCode, ...newVariant })
      .returning()
      .get();
    return toVariant(variantRow);
  }

  listVariants(familyId: string): IVariant[] {
    return this.databaseHandle
      .select()
      .from(itemVariant)
      .where(and(eq(itemVariant.familyId, familyId), eq(itemVariant.shopId, this.ctx.shopId)))
      .orderBy(asc(itemVariant.itemCode))
      .all()
      .map(toVariant);
  }

  getVariant(variantId: string): IVariant | null {
    const variantRow = this.databaseHandle
      .select()
      .from(itemVariant)
      .where(and(eq(itemVariant.id, variantId), eq(itemVariant.shopId, this.ctx.shopId)))
      .get();
    return variantRow ? toVariant(variantRow) : null;
  }

  setVariantActive(variantId: string, isActive: boolean): IVariant | null {
    const variantRow = this.databaseHandle
      .update(itemVariant)
      .set({ isActive: isActive ? 1 : 0, updatedAt: nowMs() })
      .where(and(eq(itemVariant.id, variantId), eq(itemVariant.shopId, this.ctx.shopId)))
      .returning()
      .get();
    return variantRow ? toVariant(variantRow) : null;
  }

  private stamp() {
    const now = nowMs();
    return {
      businessId: this.ctx.businessId,
      shopId: this.ctx.shopId,
      createdAt: now,
      updatedAt: now,
    };
  }
}
