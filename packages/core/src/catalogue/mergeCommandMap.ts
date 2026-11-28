import type { ILikelyDuplicate } from "../search/likelyDuplicates";
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
}

export const MERGE_COMMAND_NAMES = [
  "items.lookupBarcode",
  "items.checkDuplicates",
  "items.merge",
  "items.merge.reverse",
] as const satisfies readonly (keyof IMergeCommandMap)[];
