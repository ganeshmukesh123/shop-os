import { and, eq, inArray } from "drizzle-orm";
import type { Handle } from "../../db/connection";
import { nowMs } from "../../db/ids";
import type { Ctx } from "../../db/seed";
import { itemBarcode, itemSearchName } from "../../db/variantDetailSchema";

/** A barcode or search name as it was before a merge moved it, for the reversal to restore. */
export interface IMovedCodeRow {
  table: "item_barcode" | "item_search_name";
  id: string;
  variantId: string;
}

const sameName = (first: string, second: string) => first.toLowerCase() === second.toLowerCase();

/** A variant's barcodes and search names, and moving them between variants (spec 002 D6, T045). */
export class VariantCodesRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  /**
   * Move `fromVariantId`'s barcodes and names that `toVariantId` does not already have (a code
   * exactly, a name ignoring case) to `toVariantId`. Colliding rows stay where they are. Returns the
   * moved rows as they were.
   */
  moveNoncolliding(fromVariantId: string, toVariantId: string): IMovedCodeRow[] {
    const codesOf = (variantId: string) =>
      this.databaseHandle
        .select({ id: itemBarcode.id, code: itemBarcode.code })
        .from(itemBarcode)
        .where(and(eq(itemBarcode.variantId, variantId), eq(itemBarcode.shopId, this.ctx.shopId)))
        .all();
    const namesOf = (variantId: string) =>
      this.databaseHandle
        .select({ id: itemSearchName.id, name: itemSearchName.name })
        .from(itemSearchName)
        .where(
          and(eq(itemSearchName.variantId, variantId), eq(itemSearchName.shopId, this.ctx.shopId)),
        )
        .all();
    const survivorCodes = codesOf(toVariantId).map(({ code }) => code);
    const survivorNames = namesOf(toVariantId).map(({ name }) => name);
    const barcodeIds = codesOf(fromVariantId)
      .filter(({ code }) => !survivorCodes.includes(code))
      .map(({ id }) => id);
    const nameIds = namesOf(fromVariantId)
      .filter(({ name }) => !survivorNames.some((survivorName) => sameName(survivorName, name)))
      .map(({ id }) => id);
    this.setOwner("item_barcode", barcodeIds, toVariantId);
    this.setOwner("item_search_name", nameIds, toVariantId);
    return [
      ...barcodeIds.map((id) => ({ table: "item_barcode" as const, id, variantId: fromVariantId })),
      ...nameIds.map((id) => ({
        table: "item_search_name" as const,
        id,
        variantId: fromVariantId,
      })),
    ];
  }

  /** Give rows back to the variant recorded for them (a reversal). */
  restore(rows: readonly IMovedCodeRow[]): void {
    rows.forEach((row) => this.setOwner(row.table, [row.id], row.variantId));
  }

  private setOwner(table: IMovedCodeRow["table"], ids: readonly string[], variantId: string): void {
    if (ids.length === 0) return;
    const target = table === "item_barcode" ? itemBarcode : itemSearchName;
    this.databaseHandle
      .update(target)
      .set({ variantId, updatedAt: nowMs() })
      .where(inArray(target.id, [...ids]))
      .run();
  }
}
