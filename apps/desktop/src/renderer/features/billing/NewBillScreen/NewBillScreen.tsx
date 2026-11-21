import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flex, Heading } from "@radix-ui/themes";
import {
  evaluateDraft,
  paiseToInput,
  type Bill,
  type BillLine,
  type DraftLine,
  type Item,
} from "@shopos/core";
import { useToast } from "../../../shared/components/Toast";
import { LAYOUT } from "../../../shared/constants/layout";
import { uiText } from "../../../shared/text/strings";
import { call, messageOf } from "../../../shared/api/api";
import { emptyForm, loadDraftForm, type IBillForm } from "../billForm";
import { useDraftAutosave } from "../hooks/useDraftAutosave";
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
  const [form, setForm] = useState<IBillForm>(emptyForm());
  const [ready, setReady] = useState(false);
  const [recover, setRecover] = useState<IBillForm | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [saving, setSaving] = useState(false);
  const { query, matches, highlightedIndex, setQuery, setHighlightedIndex, clearSearch } =
    useItemSearch();
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRefs = useRef(new Map<string, HTMLInputElement>());
  const focusLine = useRef<string | null>(null);

  useEffect(() => {
    loadDraftForm()
      .then((savedForm) => savedForm && setRecover(savedForm))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useDraftAutosave(form, ready && !saved && !recover);

  useEffect(() => {
    if (focusLine.current) {
      const el = qtyRefs.current.get(focusLine.current);
      if (el) {
        el.focus();
        el.select();
        focusLine.current = null;
      }
    }
  });

  const ev = useMemo(() => evaluateDraft(form.draft), [form.draft]);

  const setDraft = (patch: Partial<IBillForm["draft"]>) =>
    setForm((previousForm) => ({ ...previousForm, draft: { ...previousForm.draft, ...patch } }));
  const patchLine = (key: string, patch: Partial<DraftLine>) =>
    setDraft({
      lines: form.draft.lines.map((draftLine) =>
        draftLine.key === key ? { ...draftLine, ...patch } : draftLine,
      ),
    });

  const addItem = useCallback(
    (it: Item) => {
      setForm((previousForm) => {
        const existing = previousForm.draft.lines.find((draftLine) => draftLine.itemId === it.id);
        if (existing) {
          focusLine.current = existing.key;
          const existingQuantity = Number(existing.qty);
          const next = Number.isFinite(existingQuantity) ? String(existingQuantity + 1) : "1";
          return {
            ...previousForm,
            draft: {
              ...previousForm.draft,
              lines: previousForm.draft.lines.map((draftLine) =>
                draftLine.key === existing.key ? { ...draftLine, qty: next } : draftLine,
              ),
            },
          };
        }
        const key = crypto.randomUUID();
        focusLine.current = key;
        const line: DraftLine = {
          key,
          itemId: it.id,
          name: it.name,
          unit: it.unit,
          allowsDecimal: it.allowsDecimal,
          qty: "1",
          rate: paiseToInput(it.pricePaise),
          disc: "",
          discMode: "rupees",
        };
        return {
          ...previousForm,
          draft: { ...previousForm.draft, lines: [...previousForm.draft.lines, line] },
        };
      });
      clearSearch();
    },
    [clearSearch],
  );

  const save = useCallback(async () => {
    if (!ev.valid || !ev.input || saving) {
      if (!ev.valid) toast("error", ev.errors[0] ?? "Check the bill");
      return;
    }
    setSaving(true);
    try {
      const saveResult = await call("bills.save", {
        clientBillId: form.clientBillId,
        customerName: form.customerName.trim() || undefined,
        paymentMode: form.paymentMode,
        billDiscountPaise: ev.billDiscountPaise,
        lines: ev.input.map(({ itemId, quantityMilli, ratePaise, lineDiscountPaise }) => ({
          itemId,
          quantityMilli,
          ratePaise,
          lineDiscountPaise,
        })),
      });
      setSaved(saveResult);
      setForm(emptyForm());
    } catch (caughtError) {
      toast("error", messageOf(caughtError));
    } finally {
      setSaving(false);
    }
  }, [ev, form, saving, toast]);

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
        onChoose={addItem}
      />

      <BillLinesTable
        lines={form.draft.lines}
        results={ev.lines}
        onLineChange={patchLine}
        onLineRemove={(lineKey) =>
          setDraft({ lines: form.draft.lines.filter((draftLine) => draftLine.key !== lineKey) })
        }
        onEnterQty={() => searchRef.current?.focus()}
        onQtyFieldRef={(lineKey, quantityField) =>
          quantityField
            ? qtyRefs.current.set(lineKey, quantityField)
            : qtyRefs.current.delete(lineKey)
        }
      />

      <BillSummaryPanel
        form={form}
        evaluation={ev}
        isSaving={saving}
        onFormChange={(patch) => setForm((previousForm) => ({ ...previousForm, ...patch }))}
        onDraftChange={setDraft}
        onClear={() => setForm(emptyForm())}
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
            setForm({ ...recover, clientBillId: recover.clientBillId ?? crypto.randomUUID() });
            setRecover(null);
          }}
        />
      )}
    </Flex>
  );
}
