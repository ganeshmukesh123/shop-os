import type { IMergeLog, IMergeMove } from "@shopos/core";
import type { itemMergeLog } from "../../db/mergeLogSchema";

export type MergeLogRow = typeof itemMergeLog.$inferSelect;

const parse = <TValue>(text: string): TValue => JSON.parse(text) as TValue;

export function toMergeLog(logRow: MergeLogRow): IMergeLog {
  return {
    id: logRow.id,
    action: logRow.action as IMergeLog["action"],
    survivorId: logRow.survivorId,
    mergedId: logRow.mergedId,
    mergeLogId: logRow.mergeLogId,
    moved: parse<IMergeMove[]>(logRow.movedJson),
    movedBatchIds: parse<string[]>(logRow.movedBatchIds),
    movedBarcodeIds: parse<string[]>(logRow.movedBarcodeIds),
    movedSearchNameIds: parse<string[]>(logRow.movedSearchNameIds),
    reason: logRow.reason,
    userLabel: logRow.userLabel,
    reversibleUntil: logRow.reversibleUntil,
    createdAt: logRow.createdAt,
  };
}
