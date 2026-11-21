import { useState } from "react";
import type { Item } from "@shopos/core";
import { ApiError, call, messageOf } from "../../../../shared/api/api";
import { useToast } from "../../../../shared/components/Toast";
import { validateItemForm } from "../validateItemForm";
import type { IItemFormFields } from "../useItemFormFields";
import type { IItemFormSave } from "./types";

/** Checks the form, then creates or updates the item; a duplicate name lists the existing items. */
export function useItemFormSave(
  fields: IItemFormFields,
  item: Item | undefined,
  onDone: () => void,
): IItemFormSave {
  const toast = useToast();
  const [errors, setErrors] = useState<string[]>([]);
  const [duplicateItems, setDuplicateItems] = useState<Item[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  async function save() {
    const { name, unit, allowsDecimal, isEditing } = fields;
    const {
      errors: foundErrors,
      pricePaise,
      openingQtyMilli,
    } = validateItemForm({
      name,
      unit,
      priceText: fields.priceText,
      openingText: fields.openingText,
      allowsDecimal,
      isEditing,
    });
    setErrors(foundErrors);
    setDuplicateItems([]);
    if (foundErrors.length || pricePaise === null) return;
    setIsBusy(true);
    try {
      if (item) await call("items.update", { id: item.id, name: name.trim(), unit, pricePaise });
      else
        await call("items.create", {
          name: name.trim(),
          unit,
          allowsDecimal,
          pricePaise,
          openingQtyMilli,
        });
      toast("success", `${name.trim()} saved`);
      onDone();
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.code === "DUPLICATE_NAME")
        setDuplicateItems(caughtError.details as Item[]);
      else setErrors([messageOf(caughtError)]);
    } finally {
      setIsBusy(false);
    }
  }

  return { errors, duplicateItems, isBusy, save };
}
