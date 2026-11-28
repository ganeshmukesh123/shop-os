import { z } from "zod";
import type { IMergeLog } from "./mergeCommands";

/** items.merge.list, exceptions.list and exceptions.resolve (spec 002 contracts, T047). */
export const itemsMergeListInput = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});
export type ItemsMergeListInput = z.input<typeof itemsMergeListInput>;

/** A merge in the merge log list, with what the screen needs to offer "Reverse". */
export interface IMergeListRow extends IMergeLog {
  survivorName: string;
  mergedName: string;
  isReversed: boolean;
}

export const EXCEPTION_STATUSES = ["open", "resolved"] as const;
export type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];

export const exceptionsListInput = z.object({
  status: z.enum(EXCEPTION_STATUSES).optional(),
  kind: z.string().min(1).max(40).optional(),
});
export type ExceptionsListInput = z.infer<typeof exceptionsListInput>;

export const exceptionsResolveInput = z.object({
  id: z.string().min(1),
  note: z.string().trim().min(1).max(200),
});
export type ExceptionsResolveInput = z.infer<typeof exceptionsResolveInput>;

/** A data issue for the owner (data-model "exception_event"). */
export interface IExceptionEvent {
  id: string;
  kind: string;
  subjectIds: string[];
  /** The items' names, in the order of subjectIds, for the screen */
  subjectNames: string[];
  detail: string | null;
  status: ExceptionStatus;
  resolvedAt: number | null;
  resolutionNote: string | null;
  createdAt: number;
}
