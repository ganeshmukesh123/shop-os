import { and, asc, eq, lt, sql, type SQL } from "drizzle-orm";
import type { Item, ItemsListInput } from "@shopos/core";
import type { Handle } from "../db/connection";
import { newId, nowIso } from "../db/ids";
import { item } from "../db/schema";
import type { Ctx } from "../db/seed";

type Row = typeof item.$inferSelect;

export function toItem(itemRow: Row): Item {
  return {
    id: itemRow.id,
    name: itemRow.name,
    unit: itemRow.unit,
    allowsDecimal: itemRow.allowsDecimal === 1,
    pricePaise: itemRow.pricePaise,
    stockMilli: itemRow.stockMilli,
    active: itemRow.active === 1,
    needsCorrection: itemRow.stockMilli < 0,
  };
}

const escapeLike = (rawText: string) =>
  rawText.replace(/[\\%_]/g, (specialCharacter) => `\\${specialCharacter}`);

export class ItemRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  create(newItemValues: {
    name: string;
    unit: string;
    allowsDecimal: boolean;
    pricePaise: number;
  }): Item {
    const now = nowIso();
    const row = this.databaseHandle
      .insert(item)
      .values({
        id: newId(),
        businessId: this.ctx.businessId,
        shopId: this.ctx.shopId,
        createdAt: now,
        updatedAt: now,
        name: newItemValues.name,
        unit: newItemValues.unit,
        allowsDecimal: newItemValues.allowsDecimal ? 1 : 0,
        pricePaise: newItemValues.pricePaise,
        stockMilli: 0,
        active: 1,
      })
      .returning()
      .get();
    return toItem(row);
  }

  update(
    id: string,
    patch: {
      name?: string;
      unit?: string;
      pricePaise?: number;
      active?: boolean;
      allowsDecimal?: boolean;
    },
  ): Item | null {
    const set: Partial<typeof item.$inferInsert> = { updatedAt: nowIso() };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.unit !== undefined) set.unit = patch.unit;
    if (patch.pricePaise !== undefined) set.pricePaise = patch.pricePaise;
    if (patch.active !== undefined) set.active = patch.active ? 1 : 0;
    if (patch.allowsDecimal !== undefined) set.allowsDecimal = patch.allowsDecimal ? 1 : 0;
    const row = this.databaseHandle.update(item).set(set).where(eq(item.id, id)).returning().get();
    return row ? toItem(row) : null;
  }

  get(id: string): Item | null {
    const row = this.databaseHandle.select().from(item).where(eq(item.id, id)).get();
    return row ? toItem(row) : null;
  }

  /** Active items whose trimmed name matches case-insensitively. */
  findActiveByName(name: string, excludeId?: string): Item[] {
    const conds: SQL[] = [sql`${item.name} = ${name} COLLATE NOCASE`, eq(item.active, 1)];
    if (excludeId) conds.push(sql`${item.id} <> ${excludeId}`);
    return this.databaseHandle
      .select()
      .from(item)
      .where(and(...conds))
      .all()
      .map(toItem);
  }

  /** Move the cached stock by a delta. Callers MUST append the matching movement in the same transaction. */
  addStockDelta(id: string, deltaMilli: number): void {
    this.databaseHandle
      .update(item)
      .set({ stockMilli: sql`${item.stockMilli} + ${deltaMilli}`, updatedAt: nowIso() })
      .where(eq(item.id, id))
      .run();
  }

  list(listInput: ItemsListInput): { items: Item[]; total: number } {
    const conds: SQL[] = [];
    if (!listInput.includeInactive) conds.push(eq(item.active, 1));
    if (listInput.needsCorrection) conds.push(lt(item.stockMilli, 0));
    const term = listInput.query?.trim();
    if (term)
      conds.push(sql`${item.name} LIKE ${"%" + escapeLike(term) + "%"} ESCAPE '\\' COLLATE NOCASE`);
    const where = conds.length ? and(...conds) : undefined;
    const total =
      this.databaseHandle
        .select({ matchingCount: sql<number>`count(*)` })
        .from(item)
        .where(where)
        .get()?.matchingCount ?? 0;
    const order: SQL[] = [];
    if (term)
      order.push(
        sql`CASE WHEN ${item.name} LIKE ${escapeLike(term) + "%"} ESCAPE '\\' COLLATE NOCASE THEN 0 ELSE 1 END`,
      );
    const rows = this.databaseHandle
      .select()
      .from(item)
      .where(where)
      .orderBy(...order, asc(sql`${item.name} COLLATE NOCASE`))
      .limit(listInput.limit)
      .offset(listInput.offset)
      .all();
    return { items: rows.map(toItem), total };
  }

  countNeedingCorrection(): number {
    return (
      this.databaseHandle
        .select({ matchingCount: sql<number>`count(*)` })
        .from(item)
        .where(and(eq(item.active, 1), lt(item.stockMilli, 0)))
        .get()?.matchingCount ?? 0
    );
  }
}
