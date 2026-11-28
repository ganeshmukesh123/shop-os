import { and, count, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { IMergeListRow } from "@shopos/core";
import type { Handle } from "../../db/connection";
import { itemVariant } from "../../db/itemSchema";
import { itemMergeLog } from "../../db/mergeLogSchema";
import type { Ctx } from "../../db/seed";
import { toMergeLog } from "./mergeLogRows";

const survivorVariant = alias(itemVariant, "survivor_variant");
const mergedVariant = alias(itemVariant, "merged_variant");
const reverseRow = alias(itemMergeLog, "reverse_row");

/** A page of merges (action merge), newest first, with both names and whether each was reversed. */
export function listMerges(
  handle: Handle,
  ctx: Ctx,
  page: { limit: number; offset: number },
): { merges: IMergeListRow[]; total: number } {
  const isMerge = and(eq(itemMergeLog.shopId, ctx.shopId), eq(itemMergeLog.action, "merge"));
  const rows = handle
    .select({
      logRow: itemMergeLog,
      survivorName: survivorVariant.displayName,
      mergedName: mergedVariant.displayName,
      reverseId: reverseRow.id,
    })
    .from(itemMergeLog)
    .innerJoin(survivorVariant, eq(survivorVariant.id, itemMergeLog.survivorId))
    .innerJoin(mergedVariant, eq(mergedVariant.id, itemMergeLog.mergedId))
    .leftJoin(reverseRow, eq(reverseRow.mergeLogId, itemMergeLog.id))
    .where(isMerge)
    .orderBy(desc(itemMergeLog.createdAt), desc(sql`${itemMergeLog}.rowid`))
    .limit(page.limit)
    .offset(page.offset)
    .all();
  const [{ total }] = handle.select({ total: count() }).from(itemMergeLog).where(isMerge).all() as [
    { total: number },
  ];
  return {
    merges: rows.map((row) => ({
      ...toMergeLog(row.logRow),
      survivorName: row.survivorName,
      mergedName: row.mergedName,
      isReversed: row.reverseId !== null,
    })),
    total,
  };
}
