import { and, asc, eq, lt, sql, type SQL } from "drizzle-orm";
import type { Item, ItemsListInput } from "@shopos/core";
import type { Handle } from "../db/connection";
import { newId, nowMs } from "../db/ids";
import { itemFamily, itemVariant } from "../db/schema";
import type { Ctx } from "../db/seed";

type Row = typeof itemVariant.$inferSelect;

const ITEM_CODE_PREFIX = "ITM-";
const ITEM_CODE_NUMBER_START = ITEM_CODE_PREFIX.length + 1; // SQL substr is 1-based
const ITEM_CODE_DIGITS = 4;

/** The screens and services still speak `Item`; an item is one family with one variant (D18). */
export function toItem(variantRow: Row): Item {
  return {
    id: variantRow.id,
    name: variantRow.displayName,
    unit: variantRow.baseUom,
    allowsDecimal: variantRow.allowDecimal === 1,
    pricePaise: variantRow.sellingPricePaise,
    stockMilli: variantRow.stockMilli,
    active: variantRow.isActive === 1,
    needsCorrection: variantRow.stockMilli < 0,
  };
}

interface IItemPatch {
  name?: string;
  unit?: string;
  pricePaise?: number;
  active?: boolean;
  allowsDecimal?: boolean;
}

/** Only the fields the caller gave; everything else on the variant stays as it is. */
function toVariantChanges(
  patch: IItemPatch,
  updatedAt: number,
): Partial<typeof itemVariant.$inferInsert> {
  return {
    updatedAt,
    ...(patch.name !== undefined && { displayName: patch.name }),
    ...(patch.unit !== undefined && { baseUom: patch.unit }),
    ...(patch.pricePaise !== undefined && { sellingPricePaise: patch.pricePaise }),
    ...(patch.active !== undefined && { isActive: patch.active ? 1 : 0 }),
    ...(patch.allowsDecimal !== undefined && { allowDecimal: patch.allowsDecimal ? 1 : 0 }),
  };
}

const escapeLike = (rawText: string) =>
  rawText.replace(/[\\%_]/g, (specialCharacter) => `\\${specialCharacter}`);

export class ItemRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  /** The next free code for this business: ITM-0001, ITM-0002, ... */
  private nextItemCode(): string {
    const highestRow = this.databaseHandle
      .select({
        highestNumber: sql<
          number | null
        >`max(cast(substr(${itemVariant.itemCode}, ${ITEM_CODE_NUMBER_START}) as integer))`,
      })
      .from(itemVariant)
      .where(eq(itemVariant.businessId, this.ctx.businessId))
      .get();
    const nextNumber = (highestRow?.highestNumber ?? 0) + 1;
    return `${ITEM_CODE_PREFIX}${String(nextNumber).padStart(ITEM_CODE_DIGITS, "0")}`;
  }

  create(newItemValues: {
    name: string;
    unit: string;
    allowsDecimal: boolean;
    pricePaise: number;
  }): Item {
    const now = nowMs();
    const stamp = {
      businessId: this.ctx.businessId,
      shopId: this.ctx.shopId,
      createdAt: now,
      updatedAt: now,
    };
    const family = this.databaseHandle
      .insert(itemFamily)
      .values({ id: newId(), ...stamp, name: newItemValues.name })
      .returning()
      .get();
    const row = this.databaseHandle
      .insert(itemVariant)
      .values({
        id: newId(),
        ...stamp,
        familyId: family.id,
        itemCode: this.nextItemCode(),
        displayName: newItemValues.name,
        baseUom: newItemValues.unit,
        allowDecimal: newItemValues.allowsDecimal ? 1 : 0,
        sellingPricePaise: newItemValues.pricePaise,
        stockMilli: 0,
        isActive: 1,
      })
      .returning()
      .get();
    return toItem(row);
  }

  update(id: string, patch: IItemPatch): Item | null {
    const updatedAt = nowMs();
    const row = this.databaseHandle
      .update(itemVariant)
      .set(toVariantChanges(patch, updatedAt))
      .where(eq(itemVariant.id, id))
      .returning()
      .get();
    if (row && patch.name !== undefined) this.renameFamily(row.familyId, patch.name, updatedAt);
    return row ? toItem(row) : null;
  }

  /** The family carries the item's name too (one family per item for now). */
  private renameFamily(familyId: string, name: string, updatedAt: number): void {
    this.databaseHandle
      .update(itemFamily)
      .set({ name, updatedAt })
      .where(eq(itemFamily.id, familyId))
      .run();
  }

  get(id: string): Item | null {
    const row = this.databaseHandle.select().from(itemVariant).where(eq(itemVariant.id, id)).get();
    return row ? toItem(row) : null;
  }

  /** Active items whose trimmed name matches case-insensitively. */
  findActiveByName(name: string, excludeId?: string): Item[] {
    const conds: SQL[] = [
      sql`${itemVariant.displayName} = ${name} COLLATE NOCASE`,
      eq(itemVariant.isActive, 1),
    ];
    if (excludeId) conds.push(sql`${itemVariant.id} <> ${excludeId}`);
    return this.databaseHandle
      .select()
      .from(itemVariant)
      .where(and(...conds))
      .all()
      .map(toItem);
  }

  /** Move the cached stock by a delta. Callers MUST append the matching movement in the same transaction. */
  addStockDelta(id: string, deltaMilli: number): void {
    this.databaseHandle
      .update(itemVariant)
      .set({ stockMilli: sql`${itemVariant.stockMilli} + ${deltaMilli}`, updatedAt: nowMs() })
      .where(eq(itemVariant.id, id))
      .run();
  }

  list(listInput: ItemsListInput): { items: Item[]; total: number } {
    const conds: SQL[] = [];
    if (!listInput.includeInactive) conds.push(eq(itemVariant.isActive, 1));
    if (listInput.needsCorrection) conds.push(lt(itemVariant.stockMilli, 0));
    const term = listInput.query?.trim();
    if (term) {
      conds.push(
        sql`${itemVariant.displayName} LIKE ${"%" + escapeLike(term) + "%"} ESCAPE '\\' COLLATE NOCASE`,
      );
    }
    const where = conds.length ? and(...conds) : undefined;
    const total =
      this.databaseHandle
        .select({ matchingCount: sql<number>`count(*)` })
        .from(itemVariant)
        .where(where)
        .get()?.matchingCount ?? 0;
    const order: SQL[] = [];
    if (term) {
      order.push(
        sql`CASE WHEN ${itemVariant.displayName} LIKE ${escapeLike(term) + "%"} ESCAPE '\\' COLLATE NOCASE THEN 0 ELSE 1 END`,
      );
    }
    const rows = this.databaseHandle
      .select()
      .from(itemVariant)
      .where(where)
      .orderBy(...order, asc(sql`${itemVariant.displayName} COLLATE NOCASE`))
      .limit(listInput.limit)
      .offset(listInput.offset)
      .all();
    return { items: rows.map(toItem), total };
  }

  countNeedingCorrection(): number {
    return (
      this.databaseHandle
        .select({ matchingCount: sql<number>`count(*)` })
        .from(itemVariant)
        .where(and(eq(itemVariant.isActive, 1), lt(itemVariant.stockMilli, 0)))
        .get()?.matchingCount ?? 0
    );
  }
}
