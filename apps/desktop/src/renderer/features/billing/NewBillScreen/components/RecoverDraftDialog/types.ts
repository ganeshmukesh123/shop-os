import type { IBillForm } from "../../../billForm";

export interface IRecoverDraftDialogProps {
  /** The unsaved bill found when the screen opened. */
  draftForm: IBillForm;
  onDiscard: () => void;
  onContinue: () => void;
}
