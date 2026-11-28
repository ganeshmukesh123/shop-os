import type { DraftEvaluation, DraftLine, Item, TintRef } from "@shopos/core";
import type { IBillForm } from "../../../billForm";

export interface IBillFormState {
  form: IBillForm;
  /** The totals and problems worked out from the lines and the bill discount. */
  evaluation: DraftEvaluation;
  /** Replaces the whole form: continuing a recovered bill. */
  replaceForm: (nextForm: IBillForm) => void;
  /** A fresh, empty form with a new clientBillId: after a save, or Clear bill. */
  resetForm: () => void;
  updateForm: (patch: Partial<Pick<IBillForm, "customerName" | "paymentMode">>) => void;
  updateDraft: (patch: Partial<IBillForm["draft"]>) => void;
  patchLine: (lineKey: string, patch: Partial<DraftLine>) => void;
  removeLine: (lineKey: string) => void;
  /** Adds a line for the item, or one more of it when it is already on the bill. */
  addItem: (item: Item) => void;
  /** Spec 002 T064: a tinted can, as a line of its own */
  addTintedItem: (item: Item, tinted: ITintedPick) => void;
}

/** What the tinting desk hands the bill: the mix, the can's price and the words for the line. */
export interface ITintedPick {
  tint: TintRef;
  ratePaise: number;
  label: string;
}
