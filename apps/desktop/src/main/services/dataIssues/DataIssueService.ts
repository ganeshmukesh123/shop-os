import {
  CoreError,
  type ExceptionsListInput,
  type ExceptionsResolveInput,
  type IExceptionEvent,
} from "@shopos/core";
import type { DB } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { ExceptionRepository } from "../../repositories/ExceptionRepository";

/** exceptions.list and exceptions.resolve (spec 002 T047): data issues for the owner. */
export class DataIssueService {
  constructor(
    private readonly db: DB,
    private readonly ctx: Ctx,
  ) {}

  list(filter: ExceptionsListInput): { events: IExceptionEvent[] } {
    return { events: new ExceptionRepository(this.db, this.ctx).list(filter) };
  }

  /** Resolve with a note. Resolving again is harmless and keeps the first note. */
  resolve(input: ExceptionsResolveInput): { event: IExceptionEvent } {
    return this.db.transaction((transaction) => {
      const issues = new ExceptionRepository(transaction, this.ctx);
      if (!issues.get(input.id))
        throw new CoreError("NOT_FOUND", "This issue is not here any more");
      issues.resolve(input.id, input.note);
      return { event: issues.get(input.id)! };
    });
  }
}
