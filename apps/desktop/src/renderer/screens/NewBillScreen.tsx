import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Callout,
  Dialog,
  Flex,
  Heading,
  SegmentedControl,
  Select,
  Table,
  Text,
  TextField,
} from "@radix-ui/themes";
import {
  evaluateDraft,
  formatQuantity,
  formatRupees,
  paiseToInput,
  PAYMENT_MODES,
  type Bill,
  type BillLine,
  type DraftLine,
  type Item,
  type PaymentMode,
} from "@shopos/core";
import { BillLineRow } from "../components/BillLineRow";
import { useToast } from "../components/Toast";
import { uiText } from "../strings";
import { call, messageOf } from "../state/api";
import {
  emptyForm,
  isEmptyForm,
  loadDraftForm,
  useDraftAutosave,
  type BillForm,
} from "../state/billDraft";
import { BillView } from "./BillView";

interface Saved {
  bill: Bill;
  lines: BillLine[];
  negativeStockItems: Item[];
}

export function NewBillScreen() {
  const toast = useToast();
  const [form, setForm] = useState<BillForm>(emptyForm());
  const [ready, setReady] = useState(false);
  const [recover, setRecover] = useState<BillForm | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Item[]>([]);
  const [hi, setHi] = useState(0);
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

  // Search as the user types (2+ characters), keeping only the latest response.
  useEffect(() => {
    if (query.trim().length < 2) {
      setMatches([]);
      return;
    }
    let live = true;
    call("items.list", { query: query.trim(), limit: 8, offset: 0 })
      .then((listResult) => {
        if (live) {
          setMatches(listResult.items);
          setHi(0);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [query]);

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

  const setDraft = (patch: Partial<BillForm["draft"]>) =>
    setForm((previousForm) => ({ ...previousForm, draft: { ...previousForm.draft, ...patch } }));
  const patchLine = (key: string, patch: Partial<DraftLine>) =>
    setDraft({
      lines: form.draft.lines.map((draftLine) =>
        draftLine.key === key ? { ...draftLine, ...patch } : draftLine,
      ),
    });

  const addItem = useCallback((it: Item) => {
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
    setQuery("");
    setMatches([]);
  }, []);

  const save = useCallback(async () => {
    if (!ev.valid || !ev.input || saving) {
      if (!ev.valid) toast("error", ev.errors[0] ?? "Check the bill");
      return;
    }
    setSaving(true);
    try {
      const saveResult = await call("bills.save", {
        customerName: form.customerName.trim() || undefined,
        customerPhone: form.customerPhone.trim() || undefined,
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
    <Flex direction="column" gap="3" style={{ maxWidth: 1000 }}>
      <Heading size="6">{uiText.bill.title}</Heading>

      <div style={{ position: "relative" }}>
        <TextField.Root
          ref={searchRef}
          size="3"
          autoFocus
          placeholder={uiText.bill.search}
          aria-label={uiText.bill.search}
          value={query}
          onChange={(changeEvent) => setQuery(changeEvent.target.value)}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === "ArrowDown") {
              keyboardEvent.preventDefault();
              setHi((previousHighlight) => Math.min(previousHighlight + 1, matches.length - 1));
            } else if (keyboardEvent.key === "ArrowUp") {
              keyboardEvent.preventDefault();
              setHi((previousHighlight) => Math.max(previousHighlight - 1, 0));
            } else if (keyboardEvent.key === "Enter" && matches[hi]) {
              keyboardEvent.preventDefault();
              addItem(matches[hi]!);
            } else if (keyboardEvent.key === "Escape") {
              setQuery("");
            }
          }}
        />
        {query.trim().length >= 2 && (
          <ul
            role="listbox"
            aria-label="Matching items"
            style={{
              position: "absolute",
              zIndex: 10,
              left: 0,
              right: 0,
              margin: 0,
              padding: 4,
              listStyle: "none",
              background: "var(--color-panel-solid)",
              border: "1px solid var(--gray-6)",
              borderRadius: 8,
              boxShadow: "var(--shadow-4)",
            }}
          >
            {matches.length === 0 && (
              <li style={{ padding: 8 }}>
                <Text color="gray">{uiText.bill.noMatch}</Text>
              </li>
            )}
            {matches.map((matchingItem, listIndex) => (
              <li
                key={matchingItem.id}
                role="option"
                aria-selected={listIndex === hi}
                onMouseDown={(mouseEvent) => {
                  mouseEvent.preventDefault();
                  addItem(matchingItem);
                }}
                onMouseEnter={() => setHi(listIndex)}
                style={{
                  padding: "8px 10px",
                  cursor: "pointer",
                  borderRadius: 6,
                  background: listIndex === hi ? "var(--accent-4)" : undefined,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  {matchingItem.name}{" "}
                  <Text color="gray" size="2">
                    ({matchingItem.unit})
                  </Text>
                </span>
                <span>
                  {formatRupees(matchingItem.pricePaise)} · stock{" "}
                  {formatQuantity(matchingItem.stockMilli)}
                  {matchingItem.needsCorrection ? " (negative)" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {form.draft.lines.length === 0 ? (
        <Text color="gray">{uiText.bill.empty}</Text>
      ) : (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>{uiText.bill.item}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{uiText.bill.qty}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{uiText.bill.rate}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{uiText.bill.discount}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell justify="end">{uiText.bill.amount}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {form.draft.lines.map((draftLine, listIndex) => (
              <BillLineRow
                key={draftLine.key}
                line={draftLine}
                result={ev.lines[listIndex]!}
                ref={(el) => {
                  if (el) qtyRefs.current.set(draftLine.key, el);
                  else qtyRefs.current.delete(draftLine.key);
                }}
                onChange={(linePatch) => patchLine(draftLine.key, linePatch)}
                onRemove={() =>
                  setDraft({
                    lines: form.draft.lines.filter((otherLine) => otherLine.key !== draftLine.key),
                  })
                }
                onEnterQty={() => searchRef.current?.focus()}
              />
            ))}
          </Table.Body>
        </Table.Root>
      )}

      <Flex gap="4" wrap="wrap" align="start">
        <Flex direction="column" gap="3" style={{ flex: 1, minWidth: 320 }}>
          <label>
            <Text as="div" size="2" weight="bold" mb="1">
              {uiText.bill.customerName}
            </Text>
            <TextField.Root
              size="3"
              maxLength={80}
              value={form.customerName}
              onChange={(changeEvent) =>
                setForm((previousForm) => ({
                  ...previousForm,
                  customerName: changeEvent.target.value,
                }))
              }
            />
          </label>
          <label>
            <Text as="div" size="2" weight="bold" mb="1">
              {uiText.bill.customerPhone}
            </Text>
            <TextField.Root
              size="3"
              inputMode="numeric"
              maxLength={15}
              value={form.customerPhone}
              onChange={(changeEvent) =>
                setForm((previousForm) => ({
                  ...previousForm,
                  customerPhone: changeEvent.target.value.replace(/\D/g, ""),
                }))
              }
            />
          </label>
          <div>
            <Text as="div" size="2" weight="bold" mb="1" id="pay-label">
              {uiText.bill.payment}
            </Text>
            <Select.Root
              value={form.paymentMode}
              onValueChange={(selectedPaymentMode) =>
                setForm((previousForm) => ({
                  ...previousForm,
                  paymentMode: selectedPaymentMode as PaymentMode,
                }))
              }
            >
              <Select.Trigger aria-labelledby="pay-label" style={{ minWidth: 160 }} />
              <Select.Content>
                {PAYMENT_MODES.map((paymentMode) => (
                  <Select.Item key={paymentMode} value={paymentMode}>
                    {uiText.payment[paymentMode]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>
        </Flex>
        <Flex direction="column" gap="2" align="end" style={{ minWidth: 320 }}>
          <Text>
            {uiText.bill.total}: <b>{formatRupees(ev.linesTotalPaise)}</b>
          </Text>
          <Flex gap="2" align="center">
            <Text size="2" weight="bold">
              {uiText.bill.billDiscount}
            </Text>
            <TextField.Root
              size="3"
              style={{ width: 100 }}
              inputMode="decimal"
              aria-label={uiText.bill.billDiscount}
              value={form.draft.billDisc}
              onChange={(changeEvent) => setDraft({ billDisc: changeEvent.target.value })}
            />
            <SegmentedControl.Root
              size="2"
              value={form.draft.billDiscMode}
              onValueChange={(selectedDiscountMode) =>
                setDraft({ billDiscMode: selectedDiscountMode as "rupees" | "percent" })
              }
              aria-label="Bill discount type"
            >
              <SegmentedControl.Item value="rupees">₹</SegmentedControl.Item>
              <SegmentedControl.Item value="percent">%</SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>
          {ev.billDiscountPaise > 0 && <Text>-{formatRupees(ev.billDiscountPaise)}</Text>}
          <Text size="7" weight="bold" aria-live="polite">
            {uiText.bill.grandTotal}: {formatRupees(ev.grandTotalPaise)}
          </Text>
          {ev.errors
            .filter(
              (errorMessage) => !errorMessage.startsWith("Fix") && !errorMessage.startsWith("Add"),
            )
            .map((errorMessage) => (
              <Text key={errorMessage} color="red" role="alert">
                Error: {errorMessage}
              </Text>
            ))}
          <Flex gap="3">
            <Button
              size="3"
              variant="soft"
              color="gray"
              disabled={isEmptyForm(form)}
              onClick={() => setForm(emptyForm())}
            >
              {uiText.bill.clear}
            </Button>
            <Button size="4" onClick={() => void save()} loading={saving} disabled={!ev.valid}>
              {uiText.bill.save} (Ctrl+S)
            </Button>
          </Flex>
        </Flex>
      </Flex>

      {recover && (
        <Dialog.Root open>
          <Dialog.Content maxWidth="440px">
            <Dialog.Title>{uiText.bill.recoverTitle}</Dialog.Title>
            <Dialog.Description>{uiText.bill.recoverBody}</Dialog.Description>
            <Callout.Root mt="3" size="1">
              <Callout.Text>
                {recover.draft.lines.length} line{recover.draft.lines.length === 1 ? "" : "s"}:{" "}
                {recover.draft.lines.map((draftLine) => draftLine.name).join(", ")}
              </Callout.Text>
            </Callout.Root>
            <Flex gap="3" mt="4" justify="end">
              <Button
                variant="soft"
                color="gray"
                size="3"
                onClick={() => {
                  setRecover(null);
                  void call("bills.draft.save", { payload: null });
                }}
              >
                {uiText.bill.discard}
              </Button>
              <Button
                size="3"
                autoFocus
                onClick={() => {
                  setForm(recover);
                  setRecover(null);
                }}
              >
                {uiText.bill.recover}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Flex>
  );
}
