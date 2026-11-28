import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import type { ExceptionsListInput, IExceptionEvent } from "@shopos/core";
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

  /** Newest first, optionally only one status or kind. */
  list(filter: ExceptionsListInput): Omit<IExceptionEvent, "subjectNames">[] {
    const conditions: SQL[] = [
      eq(exceptionEvent.shopId, this.ctx.shopId),
      ...(filter.status ? [eq(exceptionEvent.status, filter.status)] : []),
      ...(filter.kind ? [eq(exceptionEvent.kind, filter.kind)] : []),
    ];
    return this.databaseHandle
      .select()
      .from(exceptionEvent)
      .where(and(...conditions))
      .orderBy(desc(exceptionEvent.createdAt), desc(sql`rowid`))
      .all()
      .map(toExceptionEvent);
  }

  get(id: string): Omit<IExceptionEvent, "subjectNames"> | null {
    const eventRow = this.databaseHandle
      .select()
      .from(exceptionEvent)
      .where(and(eq(exceptionEvent.id, id), eq(exceptionEvent.shopId, this.ctx.shopId)))
      .get();
    return eventRow ? toExceptionEvent(eventRow) : null;
  }

  /** Open to resolved, with the note; an issue already resolved keeps its first note. */
  resolve(id: string, note: string): void {
    const now = nowMs();
    this.databaseHandle
      .update(exceptionEvent)
      .set({ status: "resolved", resolvedAt: now, resolutionNote: note, updatedAt: now })
      .where(
        and(
          eq(exceptionEvent.id, id),
          eq(exceptionEvent.shopId, this.ctx.shopId),
          eq(exceptionEvent.status, "open"),
        ),
      )
      .run();
  }
}

function toExceptionEvent(
  eventRow: typeof exceptionEvent.$inferSelect,
): Omit<IExceptionEvent, "subjectNames"> {
  return {
    id: eventRow.id,
    kind: eventRow.kind,
    subjectIds: JSON.parse(eventRow.subjectIds) as string[],
    detail: eventRow.detail,
    status: eventRow.status as IExceptionEvent["status"],
    resolvedAt: eventRow.resolvedAt,
    resolutionNote: eventRow.resolutionNote,
    createdAt: eventRow.createdAt,
  };
}
