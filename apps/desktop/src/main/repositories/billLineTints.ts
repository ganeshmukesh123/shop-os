import { asc, inArray, sql } from "drizzle-orm";
import type { BillLine } from "@shopos/core";
import type { Handle } from "../db/connection";
import type { billLine } from "../db/schema";
import { billLineTint } from "../db/tintSchema";

export type ColorantsByLine = Map<string, { name: string; qtyMilli: number }[]>;

/** The saved colorants of these bill lines, per line, in the order they were saved (T067). */
export function colorantsOfLines(handle: Handle, lineIds: readonly string[]): ColorantsByLine {
  const colorantsOf: ColorantsByLine = new Map();
  if (lineIds.length === 0) return colorantsOf;
  handle
    .select({
      billLineId: billLineTint.billLineId,
      name: billLineTint.colorantNameSnapshot,
      qtyMilli: billLineTint.qtyMilli,
    })
    .from(billLineTint)
    .where(inArray(billLineTint.billLineId, [...lineIds]))
    .orderBy(asc(billLineTint.createdAt), asc(sql`rowid`))
    .all()
    .forEach(({ billLineId, name, qtyMilli }) =>
      colorantsOf.set(billLineId, [...(colorantsOf.get(billLineId) ?? []), { name, qtyMilli }]),
    );
  return colorantsOf;
}

/** A tinted line carries its colorants per can (spec 002 T067); an ordinary one is unchanged. */
export const withTint = (
  line: BillLine,
  lineRow: typeof billLine.$inferSelect,
  colorantsOf: ColorantsByLine,
): BillLine =>
  lineRow.tintFormulaId
    ? { ...line, tint: { colorants: colorantsOf.get(lineRow.id) ?? [] } }
    : line;
