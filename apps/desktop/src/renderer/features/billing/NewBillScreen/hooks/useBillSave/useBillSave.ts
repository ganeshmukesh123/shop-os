import { useCallback, useEffect, useState } from "react";
import type { DraftEvaluation } from "@shopos/core";
import { call, messageOf } from "../../../../../shared/api/api";
import { useToast } from "../../../../../shared/components/Toast";
import type { IBillForm } from "../../../billForm";
import type { IBillSave, ISavedBill } from "./types";

/** The `bills.save` input for a valid bill; the clientBillId makes a retry safe. */
function buildSaveInput(form: IBillForm, evaluation: DraftEvaluation) {
  return {
    clientBillId: form.clientBillId,
    customerName: form.customerName.trim() || undefined,
    paymentMode: form.paymentMode,
    billDiscountPaise: evaluation.billDiscountPaise,
    lines: (evaluation.input ?? []).map(
      ({ itemId, quantityMilli, ratePaise, lineDiscountPaise }) => ({
        itemId,
        quantityMilli,
        ratePaise,
        lineDiscountPaise,
      }),
    ),
  };
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

  const save = useCallback(async () => {
    if (!evaluation.valid || !evaluation.input || isSaving) {
      if (!evaluation.valid) toast("error", evaluation.errors[0] ?? "Check the bill");
      return;
    }
    setIsSaving(true);
    try {
      setSaved(await call("bills.save", buildSaveInput(form, evaluation)));
      onSaved();
    } catch (caughtError) {
      toast("error", messageOf(caughtError));
    } finally {
      setIsSaving(false);
    }
  }, [evaluation, form, isSaving, onSaved, toast]);

  useEffect(() => {
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (
        (keyboardEvent.ctrlKey || keyboardEvent.metaKey) &&
        keyboardEvent.key.toLowerCase() === "s"
      ) {
        keyboardEvent.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [save]);

  const startNewBill = useCallback(() => setSaved(null), []);

  return { saved, isSaving, save, startNewBill };
}
