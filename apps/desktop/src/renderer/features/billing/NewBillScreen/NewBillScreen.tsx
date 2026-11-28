import { useCallback, useEffect, useRef, useState } from "react";
import { Flex, Heading } from "@radix-ui/themes";
import type { IItemSearchRow, Item } from "@shopos/core";
import { LAYOUT } from "../../../shared/constants/layout";
import { uiText } from "../../../shared/text/strings";
import { call } from "../../../shared/api/api";
import { loadDraftForm, type IBillForm } from "../billForm";
import { useDraftAutosave } from "../hooks/useDraftAutosave";
import { useBillForm } from "./hooks/useBillForm";
import { useBillSave } from "./hooks/useBillSave";
import { useBarcodeEntry } from "./hooks/useBarcodeEntry";
import { useItemSearch } from "./hooks/useItemSearch";
import { useLineConversions } from "./hooks/useLineConversions";
import { useQuantityFocus } from "./hooks/useQuantityFocus";
import { BillView } from "../BillView";
import { BillLinesTable } from "./components/BillLinesTable";
import { BillSearchBox } from "./components/BillSearchBox";
import { BillSummaryPanel } from "./components/BillSummaryPanel";
import { RecoverDraftDialog } from "./components/RecoverDraftDialog";
import { useRoundedTotal } from "../RoundOffLine/useRoundedTotal";
import { BarcodeChooser } from "../BarcodeChooser";
import { VariantGrid } from "../VariantGrid";

export function NewBillScreen() {
  const [ready, setReady] = useState(false);
  const [recover, setRecover] = useState<IBillForm | null>(null);
  const [gridFamily, setGridFamily] = useState<IItemSearchRow | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { rememberLineToFocus, onQtyFieldRef } = useQuantityFocus();
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
  useLineConversions(form.draft.lines, patchLine);
  const roundedTotal = useRoundedTotal(evaluation.grandTotalPaise);
  const { saved, isSaving, save, startNewBill } = useBillSave(form, evaluation, resetForm);
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
    if (!saved && ready) searchRef.current?.focus();
  }, [saved, ready]);

  const addItemAndClearSearch = useCallback(
    (item: Item) => {
      addItem(item);
      clearSearch();
    },
    [addItem, clearSearch],
  );
  // A variant row is added; a family row opens its grid to choose the variant (spec 002 T038)
  const chooseRow = (row: IItemSearchRow) =>
    row.item ? addItemAndClearSearch(row.item) : setGridFamily(row);
  const barcode = useBarcodeEntry(addItemAndClearSearch);
  const highlightedRow = matches[highlightedIndex];

  if (saved) {
    return (
      <BillView
        bill={saved.bill}
        lines={saved.lines}
        negativeStockItems={saved.negativeStockItems}
        onNew={startNewBill}
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
        onChoose={chooseRow}
        onEnterCode={(code) =>
          void barcode.enterCode(code, () => highlightedRow && chooseRow(highlightedRow))
        }
      />

      <BillLinesTable
        lines={form.draft.lines}
        results={evaluation.lines}
        onLineChange={patchLine}
        onLineRemove={removeLine}
        onEnterQty={() => searchRef.current?.focus()}
        onQtyFieldRef={onQtyFieldRef}
      />

      <BillSummaryPanel
        form={form}
        evaluation={evaluation}
        roundedTotal={roundedTotal}
        isSaving={isSaving}
        onFormChange={updateForm}
        onDraftChange={updateDraft}
        onClear={resetForm}
        onSave={() => void save()}
      />

      {barcode.choice && (
        <BarcodeChooser
          code={barcode.choice.code}
          items={barcode.choice.items}
          onClose={barcode.closeChoice}
          onChoose={(item) => {
            barcode.closeChoice();
            addItemAndClearSearch(item);
          }}
        />
      )}
      {gridFamily && (
        <VariantGrid
          familyId={gridFamily.id}
          title={gridFamily.displayName}
          onClose={() => setGridFamily(null)}
          onPick={(item) => {
            setGridFamily(null);
            addItemAndClearSearch(item);
          }}
        />
      )}

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
