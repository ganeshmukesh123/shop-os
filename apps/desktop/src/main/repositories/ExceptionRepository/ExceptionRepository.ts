import { and, eq } from "drizzle-orm";
import type { Handle } from "../../db/connection";
import { newId, nowMs } from "../../db/ids";
import { exceptionEvent } from "../../db/mergeLogSchema";
import type { Ctx } from "../../db/seed";

/** One data issue to record, about one or more variants (data-model "exception_event"). */
export interface INewException {
  kind: "duplicate_barcode" | "duplicate_suspect";
  subjectIds: readonly string[];
  /** What the issue is about, such as the shared code; at most 200 characters */
  detail: string;
}

/** Data issues for the owner to resolve (spec 002 T045). Open only goes to resolved. */
export class ExceptionRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  /** Record the issue unless one of the same kind and detail is still open. True when recorded. */
  openOnce(issue: INewException): boolean {
    const alreadyOpen = this.databaseHandle
      .select({ id: exceptionEvent.id })
      .from(exceptionEvent)
      .where(
        and(
          eq(exceptionEvent.shopId, this.ctx.shopId),
          eq(exceptionEvent.kind, issue.kind),
          eq(exceptionEvent.detail, issue.detail),
          eq(exceptionEvent.status, "open"),
        ),
      )
      .get();
    if (alreadyOpen) return false;
    const now = nowMs();
    this.databaseHandle
      .insert(exceptionEvent)
      .values({
        id: newId(),
        businessId: this.ctx.businessId,
        shopId: this.ctx.shopId,
        createdAt: now,
        updatedAt: now,
        kind: issue.kind,
        subjectType: "item_variant",
        subjectIds: JSON.stringify([...issue.subjectIds].sort()),
        detail: issue.detail,
      })
      .run();
    return true;
  }
}
