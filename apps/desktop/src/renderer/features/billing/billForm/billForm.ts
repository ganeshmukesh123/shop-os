import { call } from "../../../shared/api/api";
import type { IBillForm } from "./types";

export const emptyForm = (): IBillForm => ({
  clientBillId: crypto.randomUUID(),
  draft: { lines: [], billDisc: "", billDiscMode: "rupees" },
  customerName: "",
  paymentMode: "cash",
});

export const isEmptyForm = (billForm: IBillForm) =>
  billForm.draft.lines.length === 0 && !billForm.customerName && !billForm.draft.billDisc;

export async function loadDraftForm(): Promise<IBillForm | null> {
  const draftResponse = await call("bills.draft.load", {});
  const savedForm = draftResponse.payload as IBillForm | null;
  if (
    !savedForm ||
    !savedForm.draft ||
    !Array.isArray(savedForm.draft.lines) ||
    savedForm.draft.lines.length === 0
  )
    return null;
  return { ...emptyForm(), ...savedForm };
}
