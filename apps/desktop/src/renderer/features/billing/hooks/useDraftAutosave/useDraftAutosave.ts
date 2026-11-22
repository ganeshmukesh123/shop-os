import { useEffect, useRef } from "react";
import { call } from "../../../../shared/api/api";
import { isEmptyForm, type IBillForm } from "../../billForm";

/** Autosave the in-progress bill after every change so a crash or power cut loses nothing. */
export function useDraftAutosave(form: IBillForm, enabled: boolean) {
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
