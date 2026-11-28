import {
  itemsCheckDuplicatesInput,
  itemsLookupBarcodeInput,
  itemsMergeInput,
  itemsMergeReverseInput,
  type IMergeCommandMap,
  type ItemsLookupBarcodeInput,
} from "@shopos/core";
import { cmd } from "./command";
import type { Handlers, Services } from "./handlers";

/** items.lookupBarcode, items.checkDuplicates, items.merge and items.merge.reverse (spec 002 T047). */
export function createMergeHandlers({
  barcodes,
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
  };
}
