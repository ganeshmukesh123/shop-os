import { useEffect, useState } from "react";
import type { IBarcode, IBarcodeShare, ISearchName, Item } from "@shopos/core";
import { call, messageOf } from "../../../../../shared/api/api";

type IEditedName = Pick<ISearchName, "name" | "language" | "kind">;
type IEditedCode = Pick<IBarcode, "code" | "source">;

/**
 * Load the item's search names and barcodes, let the owner edit both lists, and save them with
 * variants.setSearchNames and variants.setBarcodes (spec 002 T049).
 */
export function useItemCodes(item: Item, onSaved: () => void) {
  const [names, setNames] = useState<IEditedName[]>([]);
  const [codes, setCodes] = useState<IEditedCode[]>([]);
  const [sharedWith, setSharedWith] = useState<IBarcodeShare[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Read the item's rows from main once, when the panel opens
  useEffect(() => {
    if (!item.familyId) return;
    call("families.get", { id: item.familyId })
      .then((detail) => {
        const ofItem = <TRow extends { variantId: string }>(rows: TRow[]) =>
          rows.filter((row) => row.variantId === item.id);
        setNames(
          ofItem(detail.searchNames).map(({ name, language, kind }) => ({ name, language, kind })),
        );
        setCodes(ofItem(detail.barcodes).map(({ code, source }) => ({ code, source })));
      })
      .catch((caughtError: unknown) => setError(messageOf(caughtError)));
  }, [item.familyId, item.id]);

  const save = async () => {
    try {
      await call("variants.setSearchNames", { variantIds: [item.id], names });
      const saved = await call("variants.setBarcodes", { variantId: item.id, barcodes: codes });
      setSharedWith(saved.sharedWith);
      setError(null);
      if (saved.sharedWith.length === 0) onSaved();
    } catch (caughtError) {
      setError(messageOf(caughtError));
    }
  };

  return { names, setNames, codes, setCodes, sharedWith, error, save };
}
