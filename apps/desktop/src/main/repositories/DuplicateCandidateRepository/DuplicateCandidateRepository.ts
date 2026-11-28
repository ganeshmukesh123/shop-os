import { and, eq, isNull, like, or, sql, type SQL } from "drizzle-orm";
import type { IDuplicateCandidate } from "@shopos/core";
import type { Handle } from "../../db/connection";
import { itemFamily, itemVariant } from "../../db/itemSchema";
import type { Ctx } from "../../db/seed";

/** Research D5: the check reads at most a few hundred rows. */
export const MAX_DUPLICATE_CANDIDATES = 300;
/** Words shorter than this ("1", "in") match too much to narrow the candidates. */
const MIN_WORD_LENGTH = 3;
const MAX_WORDS = 4;

/** A word for SQL LIKE, with its wildcard characters taken literally. */
const likeWord = (word: string) => `%${word.replace(/[\\%_]/g, (special) => `\\${special}`)}%`;

/**
 * Active, unmerged variants that might be the draft (spec 002 T047, research D5): the same brand,
 * or a display name containing one of the draft's words. The pure rule then decides.
 */
export class DuplicateCandidateRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  candidatesFor(name: string, brandId: string | null): IDuplicateCandidate[] {
    const words = name
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= MIN_WORD_LENGTH)
      .slice(0, MAX_WORDS);
    const matches: SQL[] = [
      ...words.map((word) => like(sql`lower(${itemVariant.displayName})`, likeWord(word))),
      ...(brandId ? [eq(itemFamily.brandId, brandId)] : []),
    ];
    if (matches.length === 0) return [];
    return this.databaseHandle
      .select({
        variantId: itemVariant.id,
        displayName: itemVariant.displayName,
        brandId: itemFamily.brandId,
        categoryId: itemFamily.categoryId,
        axisSignature: itemVariant.axisSignature,
      })
      .from(itemVariant)
      .innerJoin(itemFamily, eq(itemFamily.id, itemVariant.familyId))
      .where(
        and(
          eq(itemVariant.shopId, this.ctx.shopId),
          eq(itemVariant.isActive, 1),
          isNull(itemVariant.mergedIntoId),
          or(...matches),
        ),
      )
      .limit(MAX_DUPLICATE_CANDIDATES)
      .all();
  }
}
