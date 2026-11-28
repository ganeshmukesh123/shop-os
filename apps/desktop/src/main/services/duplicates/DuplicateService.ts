import {
  findLikelyDuplicates,
  type ILikelyDuplicate,
  type ItemsCheckDuplicatesInput,
} from "@shopos/core";
import type { DB } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { DuplicateCandidateRepository } from "../../repositories/DuplicateCandidateRepository";

/** items.checkDuplicates (spec 002 T047, FR-008): likely duplicates shown before an item is saved. */
export class DuplicateService {
  constructor(
    private readonly db: DB,
    private readonly ctx: Ctx,
  ) {}

  check({ draft }: ItemsCheckDuplicatesInput): { candidates: ILikelyDuplicate[] } {
    const brandId = draft.brandId ?? null;
    const candidates = new DuplicateCandidateRepository(this.db, this.ctx).candidatesFor(
      draft.name,
      brandId,
    );
    return {
      candidates: findLikelyDuplicates(
        {
          name: draft.name,
          brandId,
          categoryId: draft.categoryId ?? null,
          axisSignature: draft.axisSignature,
        },
        candidates,
      ),
    };
  }
}
