import { z } from "zod";

/** items.merge and items.merge.reverse (spec 002 contracts; research D6). */
export const itemsMergeInput = z.object({
  survivorId: z.string().min(1),
  mergedId: z.string().min(1),
  /** Required: an empty or blank reason is REASON_REQUIRED, from the service */
  reason: z.string().max(200),
});
export type ItemsMergeInput = z.infer<typeof itemsMergeInput>;

export const itemsMergeReverseInput = z.object({
  mergeLogId: z.string().min(1),
  reason: z.string().max(200),
});
export type ItemsMergeReverseInput = z.infer<typeof itemsMergeReverseInput>;

/** One location and batch moved by a merge, signed: negative stock moved the other way. */
export interface IMergeMove {
  locationId: string;
  batchId: string | null;
  qtyMilli: number;
}

/** A row of the append-only merge log. */
export interface IMergeLog {
  id: string;
  action: "merge" | "reverse";
  survivorId: string;
  mergedId: string;
  /** For a reversal: the merge it reverses */
  mergeLogId: string | null;
  moved: IMergeMove[];
  movedBatchIds: string[];
  movedBarcodeIds: string[];
  movedSearchNameIds: string[];
  reason: string;
  userLabel: string;
  /** For a merge: until when it may be reversed (merged time + 30 days, epoch ms) */
  reversibleUntil: number | null;
  createdAt: number;
}
