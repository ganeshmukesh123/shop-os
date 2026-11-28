import type { Item } from "@shopos/core";
import type { DB, Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { BarcodeRepository } from "../../repositories/BarcodeRepository";
import { ExceptionRepository } from "../../repositories/ExceptionRepository";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { ItemRepository } from "../../repositories/ItemRepository";

/** Merges can chain; a longer chain than this means bad data, and the lookup stops there. */
const MAX_MERGE_CHAIN = 50;

/** The variant a merged one now lives on, following merged_into_id through every merge. */
export function finalSurvivorOf(families: FamilyRepository, variantId: string, depth = 0): string {
  const mergedIntoId = families.getVariant(variantId)?.mergedIntoId ?? null;
  return mergedIntoId === null || depth >= MAX_MERGE_CHAIN
    ? variantId
    : finalSurvivorOf(families, mergedIntoId, depth + 1);
}

/**
 * items.lookupBarcode (spec 002 T043 and T047, research D7): the items a scanned code is on, each
 * merged owner replaced by its final survivor. Two or more items log one duplicate_barcode issue
 * per code, not one per scan; the screen then shows a chooser.
 */
export class BarcodeService {
  constructor(
    private readonly db: DB,
    private readonly ctx: Ctx,
  ) {}

  lookup(rawCode: string): { variants: Item[] } {
    const code = rawCode.trim();
    if (code === "") return { variants: [] };
    return this.db.transaction((transaction) => ({
      variants: this.findAndReport(transaction, code),
    }));
  }

  private findAndReport(handle: Handle, code: string): Item[] {
    const families = new FamilyRepository(handle, this.ctx);
    const survivorIds = [
      ...new Set(
        new BarcodeRepository(handle, this.ctx)
          .ownersOf(code)
          .map((variantId) => finalSurvivorOf(families, variantId)),
      ),
    ];
    if (survivorIds.length > 1) {
      new ExceptionRepository(handle, this.ctx).openOnce({
        kind: "duplicate_barcode",
        subjectIds: survivorIds,
        detail: code.slice(0, 200),
      });
    }
    const items = new ItemRepository(handle, this.ctx);
    return survivorIds.flatMap((variantId) => {
      const item = items.get(variantId);
      return item ? [item] : [];
    });
  }
}
