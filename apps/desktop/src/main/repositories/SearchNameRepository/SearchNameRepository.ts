import { and, asc, eq, inArray } from "drizzle-orm";
import type { ISearchName } from "@shopos/core";
import type { Handle } from "../../db/connection";
import { newId, nowMs } from "../../db/ids";
import type { Ctx } from "../../db/seed";
import { itemSearchName } from "../../db/variantDetailSchema";

export type INewSearchName = Pick<ISearchName, "name" | "language" | "kind">;

/** The first of each name, ignoring case: the table allows a name once per variant. */
const distinctNames = (names: readonly INewSearchName[]) =>
  names.filter(
    (candidate, candidateIndex) =>
      names.findIndex((other) => other.name.toLowerCase() === candidate.name.toLowerCase()) ===
      candidateIndex,
  );

/** Hindi, Hinglish and trade names a variant is also searched by (spec 002 T045, FR-007). */
export class SearchNameRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  listFor(variantIds: readonly string[]): ISearchName[] {
    if (variantIds.length === 0) return [];
    return this.databaseHandle
      .select({
        id: itemSearchName.id,
        variantId: itemSearchName.variantId,
        name: itemSearchName.name,
        language: itemSearchName.language,
        kind: itemSearchName.kind,
      })
      .from(itemSearchName)
      .where(
        and(
          inArray(itemSearchName.variantId, [...variantIds]),
          eq(itemSearchName.shopId, this.ctx.shopId),
        ),
      )
      .orderBy(asc(itemSearchName.variantId), asc(itemSearchName.name))
      .all() as ISearchName[];
  }

  /** Make the variant's names exactly `names` (the first of any repeated name, ignoring case). */
  replaceFor(variantId: string, names: readonly INewSearchName[]): void {
    this.databaseHandle
      .delete(itemSearchName)
      .where(
        and(eq(itemSearchName.variantId, variantId), eq(itemSearchName.shopId, this.ctx.shopId)),
      )
      .run();
    const now = nowMs();
    const rows = distinctNames(names).map((searchName) => ({
      id: newId(),
      businessId: this.ctx.businessId,
      shopId: this.ctx.shopId,
      createdAt: now,
      updatedAt: now,
      variantId,
      ...searchName,
    }));
    if (rows.length > 0) this.databaseHandle.insert(itemSearchName).values(rows).run();
  }
}
