import {
  exceptionsListInput,
  exceptionsResolveInput,
  itemsCheckDuplicatesInput,
  itemsMergeListInput,
  itemsLookupBarcodeInput,
  itemsMergeInput,
  itemsMergeReverseInput,
  type IMergeCommandMap,
  type ItemsLookupBarcodeInput,
} from "@shopos/core";
import { cmd } from "./command";
import type { Handlers, Services } from "./handlers";

/** Spec 002 T047: barcode lookup, the duplicate check, merges and their log, and data issues. */
export function createMergeHandlers({
  barcodes,
  dataIssues,
  duplicates,
  merges,
}: Services): Pick<Handlers, keyof IMergeCommandMap> {
  return {
    "items.lookupBarcode": cmd<"items.lookupBarcode">(
      itemsLookupBarcodeInput,
      (input: ItemsLookupBarcodeInput) => barcodes.lookup(input.code),
    ),
    "items.checkDuplicates": cmd<"items.checkDuplicates">(itemsCheckDuplicatesInput, (input) =>
      duplicates.check(input),
    ),
    "items.merge": cmd<"items.merge">(itemsMergeInput, (input) => merges.merge(input)),
    "items.merge.reverse": cmd<"items.merge.reverse">(itemsMergeReverseInput, (input) =>
      merges.reverse(input),
    ),
    "items.merge.list": cmd<"items.merge.list">(itemsMergeListInput, (input) => merges.list(input)),
    "exceptions.list": cmd<"exceptions.list">(exceptionsListInput, (input) =>
      dataIssues.list(input),
    ),
    "exceptions.resolve": cmd<"exceptions.resolve">(exceptionsResolveInput, (input) =>
      dataIssues.resolve(input),
    ),
  };
}
