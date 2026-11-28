import { and, asc, eq, sql } from "drizzle-orm";
import { CoreError, type IBrand, type IUnit } from "@shopos/core";
import { brand, category, uom } from "../../db/catalogueSchema";
import type { Handle } from "../../db/connection";
import { newId, nowMs } from "../../db/ids";
import type { Ctx } from "../../db/seed";

export type CategoryRow = typeof category.$inferSelect;

export interface ICategoryFields {
  parentId: string | null;
  name: string;
  defaultHsn: string | null;
  defaultBaseUom: string | null;
  titleTemplate: string | null;
}

/** SQLite reports a broken UNIQUE index this way; the caller turns it into DUPLICATE_NAME. */
const isUniqueViolation = (caughtError: unknown) =>
  caughtError instanceof Error && /UNIQUE constraint failed/.test(caughtError.message);

function asDuplicateName<TResult>(write: () => TResult, message: string): TResult {
  try {
    return write();
  } catch (caughtError) {
    if (isUniqueViolation(caughtError)) throw new CoreError("DUPLICATE_NAME", message);
    throw caughtError;
  }
}

/** Categories, brands and units (spec 002 data-model.md "Catalogue"). */
export class CatalogueRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  listUnits(): IUnit[] {
    return this.databaseHandle
      .select()
      .from(uom)
      .where(eq(uom.businessId, this.ctx.businessId))
      .orderBy(asc(uom.code))
      .all()
      .map((unitRow) => ({
        code: unitRow.code,
        label: unitRow.label,
        dimension: unitRow.dimension as IUnit["dimension"],
        allowDecimal: unitRow.allowDecimal === 1,
      }));
  }

  hasUnit(code: string): boolean {
    return this.listUnits().some((unit) => unit.code === code);
  }

  /**
   * A 001 custom unit (any text up to 20 characters) gets a uom row with dimension count and no
   * UQC the first time an item uses it (spec 002 data-model.md "uom"; migration 0022 did the same
   * for units used before the upgrade).
   */
  ensureCustomUnit(code: string, allowDecimal: boolean): void {
    if (this.hasUnit(code)) return;
    this.databaseHandle
      .insert(uom)
      .values({
        id: newId(),
        ...this.stamp(nowMs()),
        code,
        label: code,
        dimension: "count",
        uqc: null,
        allowDecimal: allowDecimal ? 1 : 0,
      })
      .run();
  }

  listCategoryRows(): CategoryRow[] {
    return this.databaseHandle
      .select()
      .from(category)
      .where(eq(category.shopId, this.ctx.shopId))
      .orderBy(sql`${category.name} COLLATE NOCASE`)
      .all();
  }

  insertCategory(fields: ICategoryFields): CategoryRow {
    const now = nowMs();
    const categoryRow = { id: newId(), ...this.stamp(now), ...fields };
    return asDuplicateName(
      () => this.databaseHandle.insert(category).values(categoryRow).returning().get(),
      `A category called ${fields.name} is already here`,
    );
  }

  updateCategory(categoryId: string, fields: ICategoryFields): CategoryRow | undefined {
    return asDuplicateName(
      () =>
        this.databaseHandle
          .update(category)
          .set({ ...fields, updatedAt: nowMs() })
          .where(and(eq(category.id, categoryId), eq(category.shopId, this.ctx.shopId)))
          .returning()
          .get(),
      `A category called ${fields.name} is already here`,
    );
  }

  listBrands(): IBrand[] {
    return this.databaseHandle
      .select({ id: brand.id, name: brand.name })
      .from(brand)
      .where(eq(brand.shopId, this.ctx.shopId))
      .orderBy(sql`${brand.name} COLLATE NOCASE`)
      .all();
  }

  insertBrand(name: string): IBrand {
    return asDuplicateName(
      () =>
        this.databaseHandle
          .insert(brand)
          .values({ id: newId(), ...this.stamp(nowMs()), name })
          .returning({ id: brand.id, name: brand.name })
          .get(),
      `The brand ${name} is already saved`,
    );
  }

  updateBrand(brandId: string, name: string): IBrand | undefined {
    return asDuplicateName(
      () =>
        this.databaseHandle
          .update(brand)
          .set({ name, updatedAt: nowMs() })
          .where(and(eq(brand.id, brandId), eq(brand.shopId, this.ctx.shopId)))
          .returning({ id: brand.id, name: brand.name })
          .get(),
      `The brand ${name} is already saved`,
    );
  }

  private stamp(now: number) {
    return {
      businessId: this.ctx.businessId,
      shopId: this.ctx.shopId,
      createdAt: now,
      updatedAt: now,
    };
  }
}
