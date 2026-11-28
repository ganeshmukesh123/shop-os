import { CoreError } from "@shopos/core";
import type { Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { BillTintRepository } from "../../repositories/BillTintRepository";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { ItemRepository } from "../../repositories/ItemRepository";
import { StockRepository } from "../../repositories/StockRepository";
import { finalSurvivorOf } from "../barcode";
import type { ITintedLine } from "./tintedLines";

/** A colorant amount for all the cans: 12.5 ml x 2 cans = 25 ml (25000). Cans are whole. */
function forAllCans(qtyMilliPerCan: number, cansMilli: number): number {
  const totalMilli = (qtyMilliPerCan * cansMilli) / 1000;
  if (!Number.isInteger(totalMilli)) {
    throw new CoreError("INVALID_QUANTITY", "A tinted line is sold in whole cans");
  }
  return totalMilli;
}

/**
 * Inside the bill transaction: the line's colorant snapshot rows, and one `sale` movement per
 * colorant on its survivor, so the colorant stock that moved in a merge stays exact (SC-004).
 * Returns the colorant variants posted, for the below-zero list.
 */
export function writeTintedLine(
  handle: Handle,
  ctx: Ctx,
  saved: { billId: string; billLineId: string; cansMilli: number },
  tinted: ITintedLine,
): string[] {
  new BillTintRepository(handle, ctx).insertColorants(saved.billLineId, tinted.colorants);
  const families = new FamilyRepository(handle, ctx);
  const stock = new StockRepository(handle, ctx);
  const items = new ItemRepository(handle, ctx);
  return tinted.colorants.map((colorant) => {
    const postedId = finalSurvivorOf(families, colorant.colorantVariantId);
    const usedMilli = forAllCans(colorant.qtyMilli, saved.cansMilli);
    stock.append({
      itemId: postedId,
      quantityMilli: -usedMilli,
      reason: "sale",
      billId: saved.billId,
    });
    items.addStockDelta(postedId, -usedMilli);
    return postedId;
  });
}
