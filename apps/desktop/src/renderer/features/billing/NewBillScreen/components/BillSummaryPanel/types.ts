import type { DraftEvaluation } from "@shopos/core";
import type { IBillForm } from "../../../billForm";

export interface IBillSummaryPanelProps {
  form: IBillForm;
  /** The totals and problems worked out from the lines and the bill discount. */
  evaluation: DraftEvaluation;
  isSaving: boolean;
  onFormChange: (patch: Partial<Pick<IBillForm, "customerName" | "paymentMode">>) => void;
  onDraftChange: (patch: Partial<IBillForm["draft"]>) => void;
  onClear: () => void;
  onSave: () => void;
}
