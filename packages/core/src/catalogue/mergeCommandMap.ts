import type { ILikelyDuplicate } from "../search/likelyDuplicates";
import type {
  IBarcode,
  IBarcodeShare,
  ISearchName,
  VariantsSetBarcodesInput,
  VariantsSetSearchNamesInput,
} from "./codeCommands";
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

/** The US2 commands of spec 002 (contracts/ipc-commands.md): lookup, duplicates, merges, issues, codes. */
export interface IMergeCommandMap {
  "items.lookupBarcode": [ItemsLookupBarcodeInput, { variants: Item[] }];
  "items.checkDuplicates": [ItemsCheckDuplicatesInput, { candidates: ILikelyDuplicate[] }];
  "items.merge": [ItemsMergeInput, { mergeLog: IMergeLog; survivor: Item }];
  "items.merge.reverse": [ItemsMergeReverseInput, { reverseLog: IMergeLog }];
  "items.merge.list": [ItemsMergeListInput, { merges: IMergeListRow[]; total: number }];
  "exceptions.list": [ExceptionsListInput, { events: IExceptionEvent[] }];
  "exceptions.resolve": [ExceptionsResolveInput, { event: IExceptionEvent }];
  "variants.setBarcodes": [
    VariantsSetBarcodesInput,
    { barcodes: IBarcode[]; sharedWith: IBarcodeShare[] },
  ];
  "variants.setSearchNames": [VariantsSetSearchNamesInput, { searchNames: ISearchName[] }];
}

export const MERGE_COMMAND_NAMES = [
  "items.lookupBarcode",
  "items.checkDuplicates",
  "items.merge",
  "items.merge.reverse",
  "items.merge.list",
  "exceptions.list",
  "exceptions.resolve",
  "variants.setBarcodes",
  "variants.setSearchNames",
] as const satisfies readonly (keyof IMergeCommandMap)[];
