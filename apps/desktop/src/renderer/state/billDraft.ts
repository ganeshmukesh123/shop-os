import { useEffect, useRef } from "react";
import type { DraftBill, PaymentMode } from "@shopos/core";
import { call } from "./api";

export interface BillForm {
  /** Made when the bill is started; sent with the save so a retry can never create a second bill. */
  clientBillId: string;
  draft: DraftBill;
  customerName: string;
  paymentMode: PaymentMode;
}

export const emptyForm = (): BillForm => ({
  clientBillId: crypto.randomUUID(),
  draft: { lines: [], billDisc: "", billDiscMode: "rupees" },
  customerName: "",
  paymentMode: "cash",
});

export const isEmptyForm = (billForm: BillForm) =>
  billForm.draft.lines.length === 0 && !billForm.customerName && !billForm.draft.billDisc;

/** Autosave the in-progress bill after every change so a crash or power cut loses nothing. */
export function useDraftAutosave(form: BillForm, enabled: boolean) {
  const first = useRef(true);
  useEffect(() => {
    if (!enabled) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const autosaveTimer = setTimeout(() => {
      call("bills.draft.save", { payload: isEmptyForm(form) ? null : form }).catch(() => {});
    }, 300);
    return () => clearTimeout(autosaveTimer);
  }, [form, enabled]);
}

export async function loadDraftForm(): Promise<BillForm | null> {
  const draftResponse = await call("bills.draft.load", {});
  const savedForm = draftResponse.payload as BillForm | null;
  if (
    !savedForm ||
    !savedForm.draft ||
    !Array.isArray(savedForm.draft.lines) ||
    savedForm.draft.lines.length === 0
  )
    return null;
  return { ...emptyForm(), ...savedForm };
}
