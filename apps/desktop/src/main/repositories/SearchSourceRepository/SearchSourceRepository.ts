import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { ISearchEntry } from "@shopos/core";
import type { Handle } from "../../db/connection";
import { itemFamily, itemVariant } from "../../db/itemSchema";
import { itemBarcode, itemSalesStat, itemSearchName } from "../../db/variantDetailSchema";
import type { Ctx } from "../../db/seed";

interface ILiveVariant {
  variantId: string;
  familyId: string;
  displayName: string;
  familyName: string;
  itemCode: string;
}

/**
 * Reads what the search index holds (spec 002 research D4, data-model.md D6). It never writes.
 * A searchable variant is active and not merged. A merged variant's retained barcode and search
 * names belong to its survivor, found by following merged_into_id to the end of the chain.
 */
export class SearchSourceRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  /** The entries of the given families, or of every family when none are given. */
  entries(familyIds?: readonly string[]): ISearchEntry[] {
    const liveVariants = this.liveVariants(familyIds);
    const { survivorOf, mergedVariantIds } = this.survivorResolver();
    // A whole-shop build reads every row; a family refresh reads only its own variants' rows and
    // those of variants merged into them (merged variants are few).
    const ownerIds = familyIds
      ? [...liveVariants.map(({ variantId }) => variantId), ...mergedVariantIds]
      : undefined;
    const namesByVariant = new Map<string, string[]>();
    const codesByVariant = new Map<string, string[]>();
    const append = (byVariant: Map<string, string[]>, variantId: string, text: string) =>
      byVariant.set(variantId, [...(byVariant.get(variantId) ?? []), text]);
    this.searchNames(ownerIds).forEach(({ variantId, name }) =>
      append(namesByVariant, survivorOf(variantId), name),
    );
    this.barcodes(ownerIds).forEach(({ variantId, code }) =>
      append(codesByVariant, survivorOf(variantId), code),
    );
    const variantCountByFamily = new Map<string, number>();
    liveVariants.forEach(({ familyId }) =>
      variantCountByFamily.set(familyId, (variantCountByFamily.get(familyId) ?? 0) + 1),
    );
    return liveVariants.map((variant) => ({
      variantId: variant.variantId,
      familyId: variant.familyId,
      familyVariantCount: variantCountByFamily.get(variant.familyId) ?? 1,
      names: [
        variant.displayName,
        variant.familyName,
        ...(namesByVariant.get(variant.variantId) ?? []),
      ],
      codes: [variant.itemCode, ...(codesByVariant.get(variant.variantId) ?? [])],
    }));
  }

  /** The family of a variant, active or not, merged or not; null when there is no such variant. */
  familyOf(variantId: string): string | null {
    const variantRow = this.databaseHandle
      .select({ familyId: itemVariant.familyId })
      .from(itemVariant)
      .where(and(eq(itemVariant.id, variantId), eq(itemVariant.shopId, this.ctx.shopId)))
      .get();
    return variantRow?.familyId ?? null;
  }

  /** Bills in the last 90 days per variant, from the item_sales_stat projection. */
  billCounts(): Map<string, number> {
    const statRows = this.databaseHandle
      .select({ variantId: itemSalesStat.variantId, billCount: itemSalesStat.billCount90d })
      .from(itemSalesStat)
      .where(eq(itemSalesStat.shopId, this.ctx.shopId))
      .all();
    return new Map(statRows.map((statRow) => [statRow.variantId, statRow.billCount]));
  }

  private liveVariants(familyIds?: readonly string[]): ILiveVariant[] {
    const conditions = [
      eq(itemVariant.shopId, this.ctx.shopId),
      eq(itemVariant.isActive, 1),
      isNull(itemVariant.mergedIntoId),
    ];
    const familyFilter = familyIds ? [inArray(itemVariant.familyId, [...familyIds])] : [];
    return this.databaseHandle
      .select({
        variantId: itemVariant.id,
        familyId: itemVariant.familyId,
        displayName: itemVariant.displayName,
        familyName: itemFamily.name,
        itemCode: itemVariant.itemCode,
      })
      .from(itemVariant)
      .innerJoin(itemFamily, eq(itemFamily.id, itemVariant.familyId))
      .where(and(...conditions, ...familyFilter))
      .all();
  }

  /** survivorOf(variantId): follow merged_into_id through every merge (data-model.md D6). */
  private survivorResolver(): {
    survivorOf: (variantId: string) => string;
    mergedVariantIds: string[];
  } {
    const mergedRows = this.databaseHandle
      .select({ variantId: itemVariant.id, mergedIntoId: itemVariant.mergedIntoId })
      .from(itemVariant)
      .where(and(eq(itemVariant.shopId, this.ctx.shopId), isNotNull(itemVariant.mergedIntoId)))
      .all();
    const mergedInto = new Map(
      mergedRows.map(({ variantId, mergedIntoId }) => [variantId, mergedIntoId!] as const),
    );
    const survivorOf = (variantId: string) => {
      const seen = new Set<string>();
      let current = variantId;
      while (mergedInto.has(current) && !seen.has(current)) {
        seen.add(current);
        current = mergedInto.get(current)!;
      }
      return current;
    };
    return { survivorOf, mergedVariantIds: [...mergedInto.keys()] };
  }

  private searchNames(ownerIds?: readonly string[]): { variantId: string; name: string }[] {
    const ownerFilter = ownerIds ? [inArray(itemSearchName.variantId, [...ownerIds])] : [];
    return this.databaseHandle
      .select({ variantId: itemSearchName.variantId, name: itemSearchName.name })
      .from(itemSearchName)
      .where(and(eq(itemSearchName.shopId, this.ctx.shopId), ...ownerFilter))
      .all();
  }

  private barcodes(ownerIds?: readonly string[]): { variantId: string; code: string }[] {
    const ownerFilter = ownerIds ? [inArray(itemBarcode.variantId, [...ownerIds])] : [];
    return this.databaseHandle
      .select({ variantId: itemBarcode.variantId, code: itemBarcode.code })
      .from(itemBarcode)
      .where(and(eq(itemBarcode.shopId, this.ctx.shopId), ...ownerFilter))
      .all();
  }
}
