import {
  CoreError,
  type ExceptionsListInput,
  type ExceptionsResolveInput,
  type IExceptionEvent,
} from "@shopos/core";
import type { DB, Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { ExceptionRepository } from "../../repositories/ExceptionRepository";
import { FamilyRepository } from "../../repositories/FamilyRepository";

/** The issue with its items' names; an item no longer there shows as an empty name. */
function withNames(
  handle: Handle,
  ctx: Ctx,
  event: Omit<IExceptionEvent, "subjectNames">,
): IExceptionEvent {
  const families = new FamilyRepository(handle, ctx);
  const subjectNames = event.subjectIds.map(
    (variantId) => families.getVariant(variantId)?.displayName ?? "",
  );
  return { ...event, subjectNames };
}

/** exceptions.list and exceptions.resolve (spec 002 T047): data issues for the owner. */
export class DataIssueService {
  constructor(
    private readonly db: DB,
    private readonly ctx: Ctx,
  ) {}

  list(filter: ExceptionsListInput): { events: IExceptionEvent[] } {
    const events = new ExceptionRepository(this.db, this.ctx).list(filter);
    return { events: events.map((event) => withNames(this.db, this.ctx, event)) };
  }

  /** Resolve with a note. Resolving again is harmless and keeps the first note. */
  resolve(input: ExceptionsResolveInput): { event: IExceptionEvent } {
    return this.db.transaction((transaction) => {
      const issues = new ExceptionRepository(transaction, this.ctx);
      if (!issues.get(input.id))
        throw new CoreError("NOT_FOUND", "This issue is not here any more");
      issues.resolve(input.id, input.note);
      return { event: withNames(transaction, this.ctx, issues.get(input.id)!) };
    });
  }
}
