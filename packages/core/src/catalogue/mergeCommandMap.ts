import type { ILikelyDuplicate } from "../search/likelyDuplicates";
import type {
  ExceptionsListInput,
  ExceptionsResolveInput,
  IExceptionEvent,
  IMergeListRow,
  ItemsMergeListInput,
} from "./issueCommands";
import type { Item } from "../types";
import type {
  IMergeLog,
  ItemsCheckDuplicatesInput,
  ItemsLookupBarcodeInput,
  ItemsMergeInput,
  ItemsMergeReverseInput,
} from "./mergeCommands";

/** The US2 lookup, duplicate and merge commands of spec 002 (contracts/ipc-commands.md). */
export interface IMergeCommandMap {
  "items.lookupBarcode": [ItemsLookupBarcodeInput, { variants: Item[] }];
  "items.checkDuplicates": [ItemsCheckDuplicatesInput, { candidates: ILikelyDuplicate[] }];
  "items.merge": [ItemsMergeInput, { mergeLog: IMergeLog; survivor: Item }];
  "items.merge.reverse": [ItemsMergeReverseInput, { reverseLog: IMergeLog }];
  "items.merge.list": [ItemsMergeListInput, { merges: IMergeListRow[]; total: number }];
  "exceptions.list": [ExceptionsListInput, { events: IExceptionEvent[] }];
  "exceptions.resolve": [ExceptionsResolveInput, { event: IExceptionEvent }];
}

export const MERGE_COMMAND_NAMES = [
  "items.lookupBarcode",
  "items.checkDuplicates",
  "items.merge",
  "items.merge.reverse",
  "items.merge.list",
  "exceptions.list",
  "exceptions.resolve",
] as const satisfies readonly (keyof IMergeCommandMap)[];
