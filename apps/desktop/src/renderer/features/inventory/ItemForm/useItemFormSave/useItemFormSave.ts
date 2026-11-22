import { useRef, useState } from "react";
import type { Item } from "@shopos/core";
import { ApiError, call, messageOf } from "../../../../shared/api/api";
import { useToast } from "../../../../shared/components/Toast";
import { fillText } from "../../../../shared/text/fillText";
import { uiText } from "../../../../shared/text/strings";
import { validateItemForm } from "../validateItemForm";
import type { IItemFormFields } from "../useItemFormFields";
import type { IItemFormSave } from "./types";

interface IItemToSend {
  name: string;
  unit: string;
  allowsDecimal: boolean;
  pricePaise: number;
  openingQtyMilli: number;
}

/** Updates the item being edited, or creates a new one with its opening stock. */
async function sendItem(item: Item | undefined, itemToSend: IItemToSend): Promise<void> {
  const { name, unit, pricePaise } = itemToSend;
  if (item) {
    await call("items.update", { id: item.id, name, unit, pricePaise });
    return;
  }
  await call("items.create", itemToSend);
}

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
  // State updates only on the next render, so a second Enter in the same moment would still see
  // isBusy false; the ref blocks it at once.
  const isSaveRunning = useRef(false);

  async function save() {
    if (isSaveRunning.current) {
      return;
    }
    isSaveRunning.current = true;
    try {
      await validateAndSend();
    } finally {
      isSaveRunning.current = false;
    }
  }

  async function validateAndSend() {
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
      await sendItem(item, { name: name.trim(), unit, allowsDecimal, pricePaise, openingQtyMilli });
      toast("success", fillText(uiText.form.saved, { name: name.trim() }));
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
