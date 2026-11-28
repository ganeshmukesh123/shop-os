import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftEvaluation } from "@shopos/core";
import { call, messageOf } from "../../../../../shared/api/api";
import { useToast } from "../../../../../shared/components/Toast";
import { uiText } from "../../../../../shared/text/strings";
import type { IBillForm } from "../../../billForm";
import type { IBillSave, ISavedBill } from "./types";

/** The `bills.save` input for a valid bill; the clientBillId makes a retry safe. */
function buildSaveInput(form: IBillForm, evaluation: DraftEvaluation) {
  return {
    clientBillId: form.clientBillId,
    customerName: form.customerName.trim() || undefined,
    paymentMode: form.paymentMode,
    billDiscountPaise: evaluation.billDiscountPaise,
    // A line in another unit is sent as typed (2 roll); the main process converts it again
    lines: (evaluation.input ?? []).map(
      ({ itemId, quantityMilli, ratePaise, lineDiscountPaise, enteredUom, qtyEnteredMilli }) =>
        enteredUom
          ? { itemId, quantityMilli: qtyEnteredMilli!, ratePaise, lineDiscountPaise, enteredUom }
          : { itemId, quantityMilli, ratePaise, lineDiscountPaise },
    ),
  };
}

/** Ctrl+S (Cmd+S on a Mac) saves the bill while the screen is open. */
function useSaveShortcut(save: () => Promise<void>): void {
  useEffect(() => {
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      const isSaveShortcut =
        (keyboardEvent.ctrlKey || keyboardEvent.metaKey) && keyboardEvent.key.toLowerCase() === "s";
      if (isSaveShortcut) {
        keyboardEvent.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [save]);
}

/** Saves the bill once (button or Ctrl/Cmd+S), shows why it could not, and remembers the result. */
export function useBillSave(
  form: IBillForm,
  evaluation: DraftEvaluation,
  onSaved: () => void,
): IBillSave {
  const toast = useToast();
  const [saved, setSaved] = useState<ISavedBill | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // State updates only on the next render, so a second Ctrl+S in the same moment would still see
  // isSaving false; the ref blocks it at once.
  const isSaveRunning = useRef(false);

  const save = useCallback(async () => {
    const isInvalid = evaluation.valid === false;
    if (isInvalid) {
      toast("error", evaluation.errors[0] ?? uiText.bill.checkBill);
      return;
    }
    const isBlocked = evaluation.input === null || isSaveRunning.current;
    if (isBlocked) {
      return;
    }
    isSaveRunning.current = true;
    setIsSaving(true);
    try {
      setSaved(await call("bills.save", buildSaveInput(form, evaluation)));
      onSaved();
    } catch (caughtError) {
      toast("error", messageOf(caughtError));
    } finally {
      isSaveRunning.current = false;
      setIsSaving(false);
    }
  }, [evaluation, form, onSaved, toast]);

  useSaveShortcut(save);

  const startNewBill = useCallback(() => setSaved(null), []);

  return { saved, isSaving, save, startNewBill };
}
