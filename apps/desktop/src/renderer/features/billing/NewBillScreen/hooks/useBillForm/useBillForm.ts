import { useCallback, useMemo, useState } from "react";
import { evaluateDraft, paiseToInput, type DraftLine, type Item } from "@shopos/core";
import { emptyForm, type IBillForm } from "../../../billForm";
import type { IBillFormState } from "./types";

const withLines = (form: IBillForm, lines: DraftLine[]): IBillForm => ({
  ...form,
  draft: { ...form.draft, lines },
});

function buildLine(item: Item, lineKey: string): DraftLine {
  return {
    key: lineKey,
    itemId: item.id,
    name: item.name,
    unit: item.unit,
    allowsDecimal: item.allowsDecimal,
    qty: "1",
    rate: paiseToInput(item.pricePaise),
    disc: "",
    discMode: "rupees",
    // Its other units are read after the line is added (useLineConversions, spec 002 T039)
    familyId: item.familyId,
    enteredUom: null,
  };
}

/** The quantity text after adding one more: "2" becomes "3", and anything unreadable becomes "1". */
function quantityTextPlusOne(quantityText: string): string {
  const quantity = Number(quantityText);
  return Number.isFinite(quantity) ? String(quantity + 1) : "1";
}

function addItemToForm(
  form: IBillForm,
  item: Item,
  onLineToFocus: (lineKey: string) => void,
): IBillForm {
  const existingLine = form.draft.lines.find((draftLine) => draftLine.itemId === item.id);
  if (existingLine) {
    onLineToFocus(existingLine.key);
    return withLines(
      form,
      form.draft.lines.map((draftLine) =>
        draftLine.key === existingLine.key
          ? { ...draftLine, qty: quantityTextPlusOne(draftLine.qty) }
          : draftLine,
      ),
    );
  }
  const lineKey = crypto.randomUUID();
  onLineToFocus(lineKey);
  return withLines(form, [...form.draft.lines, buildLine(item, lineKey)]);
}

/**
 * The bill being made: the form, its totals, and the ways to change it. `onLineToFocus` is told
 * which line was just added or increased, so the screen can move the cursor to its quantity.
 */
export function useBillForm(onLineToFocus: (lineKey: string) => void): IBillFormState {
  const [form, setForm] = useState<IBillForm>(emptyForm());
  const evaluation = useMemo(() => evaluateDraft(form.draft), [form.draft]);

  const updateForm = useCallback(
    (patch: Partial<IBillForm>) => setForm((previousForm) => ({ ...previousForm, ...patch })),
    [],
  );
  const updateDraft = useCallback(
    (patch: Partial<IBillForm["draft"]>) =>
      setForm((previousForm) => ({ ...previousForm, draft: { ...previousForm.draft, ...patch } })),
    [],
  );
  const patchLine = useCallback(
    (lineKey: string, patch: Partial<DraftLine>) =>
      setForm((previousForm) =>
        withLines(
          previousForm,
          previousForm.draft.lines.map((draftLine) =>
            draftLine.key === lineKey ? { ...draftLine, ...patch } : draftLine,
          ),
        ),
      ),
    [],
  );
  const removeLine = useCallback(
    (lineKey: string) =>
      setForm((previousForm) =>
        withLines(
          previousForm,
          previousForm.draft.lines.filter((draftLine) => draftLine.key !== lineKey),
        ),
      ),
    [],
  );
  const addItem = useCallback(
    (item: Item) => setForm((previousForm) => addItemToForm(previousForm, item, onLineToFocus)),
    [onLineToFocus],
  );
  const resetForm = useCallback(() => setForm(emptyForm()), []);

  return {
    form,
    evaluation,
    replaceForm: setForm,
    resetForm,
    updateForm,
    updateDraft,
    patchLine,
    removeLine,
    addItem,
  };
}
