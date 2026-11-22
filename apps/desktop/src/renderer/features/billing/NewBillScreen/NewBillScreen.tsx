import { useCallback, useEffect, useRef, useState } from "react";
import { Flex, Heading } from "@radix-ui/themes";
import type { Bill, BillLine, Item } from "@shopos/core";
import { useToast } from "../../../shared/components/Toast";
import { LAYOUT } from "../../../shared/constants/layout";
import { uiText } from "../../../shared/text/strings";
import { call, messageOf } from "../../../shared/api/api";
import { loadDraftForm, type IBillForm } from "../billForm";
import { useDraftAutosave } from "../hooks/useDraftAutosave";
import { useBillForm } from "./hooks/useBillForm";
import { useItemSearch } from "./hooks/useItemSearch";
import { BillView } from "../BillView";
import { BillLinesTable } from "./components/BillLinesTable";
import { BillSearchBox } from "./components/BillSearchBox";
import { BillSummaryPanel } from "./components/BillSummaryPanel";
import { RecoverDraftDialog } from "./components/RecoverDraftDialog";

interface Saved {
  bill: Bill;
  lines: BillLine[];
  negativeStockItems: Item[];
}

export function NewBillScreen() {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [recover, setRecover] = useState<IBillForm | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRefs = useRef(new Map<string, HTMLInputElement>());
  const focusLine = useRef<string | null>(null);
  const rememberLineToFocus = useCallback((lineKey: string) => {
    focusLine.current = lineKey;
  }, []);
  const {
    form,
    evaluation,
    replaceForm,
    resetForm,
    updateForm,
    updateDraft,
    patchLine,
    removeLine,
    addItem,
  } = useBillForm(rememberLineToFocus);
  const { query, matches, highlightedIndex, setQuery, setHighlightedIndex, clearSearch } =
    useItemSearch();

  useEffect(() => {
    loadDraftForm()
      .then((savedForm) => savedForm && setRecover(savedForm))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useDraftAutosave(form, ready && !saved && !recover);

  useEffect(() => {
    if (focusLine.current) {
      const quantityField = qtyRefs.current.get(focusLine.current);
      if (quantityField) {
        quantityField.focus();
        quantityField.select();
        focusLine.current = null;
      }
    }
  });

  const addItemAndClearSearch = useCallback(
    (item: Item) => {
      addItem(item);
      clearSearch();
    },
    [addItem, clearSearch],
  );

  const save = useCallback(async () => {
    if (!evaluation.valid || !evaluation.input || saving) {
      if (!evaluation.valid) toast("error", evaluation.errors[0] ?? "Check the bill");
      return;
    }
    setSaving(true);
    try {
      const saveResult = await call("bills.save", {
        clientBillId: form.clientBillId,
        customerName: form.customerName.trim() || undefined,
        paymentMode: form.paymentMode,
        billDiscountPaise: evaluation.billDiscountPaise,
        lines: evaluation.input.map(({ itemId, quantityMilli, ratePaise, lineDiscountPaise }) => ({
          itemId,
          quantityMilli,
          ratePaise,
          lineDiscountPaise,
        })),
      });
      setSaved(saveResult);
      resetForm();
    } catch (caughtError) {
      toast("error", messageOf(caughtError));
    } finally {
      setSaving(false);
    }
  }, [evaluation, form, resetForm, saving, toast]);

  // Ctrl/Cmd+S saves the bill.
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

  useEffect(() => {
    if (!saved && ready) searchRef.current?.focus();
  }, [saved, ready]);

  if (saved) {
    return (
      <BillView
        bill={saved.bill}
        lines={saved.lines}
        negativeStockItems={saved.negativeStockItems}
        onNew={() => setSaved(null)}
      />
    );
  }

  return (
    <Flex direction="column" gap="3" maxWidth={LAYOUT.pageWide}>
      <Heading size="6">{uiText.bill.title}</Heading>

      <BillSearchBox
        ref={searchRef}
        query={query}
        matches={matches}
        highlightedIndex={highlightedIndex}
        onQueryChange={setQuery}
        onHighlightChange={setHighlightedIndex}
        onChoose={addItemAndClearSearch}
      />

      <BillLinesTable
        lines={form.draft.lines}
        results={evaluation.lines}
        onLineChange={patchLine}
        onLineRemove={removeLine}
        onEnterQty={() => searchRef.current?.focus()}
        onQtyFieldRef={(lineKey, quantityField) =>
          quantityField
            ? qtyRefs.current.set(lineKey, quantityField)
            : qtyRefs.current.delete(lineKey)
        }
      />

      <BillSummaryPanel
        form={form}
        evaluation={evaluation}
        isSaving={saving}
        onFormChange={updateForm}
        onDraftChange={updateDraft}
        onClear={resetForm}
        onSave={() => void save()}
      />

      {recover && (
        <RecoverDraftDialog
          draftForm={recover}
          onDiscard={() => {
            setRecover(null);
            void call("bills.draft.save", { payload: null });
          }}
          onContinue={() => {
            replaceForm({ ...recover, clientBillId: recover.clientBillId ?? crypto.randomUUID() });
            setRecover(null);
          }}
        />
      )}
    </Flex>
  );
}
